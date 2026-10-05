import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { foods, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { DomainError } from "@/server/errors";
import { cacheProduct } from "@/server/open-food-facts";
import {
  createCustomFood,
  createRecipe,
  deleteOwnFood,
  favoriteFoods,
  getFood,
  getFoodDetails,
  recentFoods,
  searchFoods,
  setFavorite,
  setUnitWeight,
} from "@/server/foods";
import {
  addEntry,
  copyEntries,
  daySummary,
  deleteEntry,
  entriesOn,
  setWater,
  setWeight,
  streakFor,
  updateEntry,
  weightOverview,
} from "@/server/journal";
import { findByBarcode, importOpenFoodFactsProduct, searchOpenFoodFacts } from "@/server/open-food-facts";
import { saveOnboarding } from "@/server/profile";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 82,
  goal: "lose_weight",
  targetWeightKg: 76,
  activityLevel: 2,
  pace: "gentle",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily" as const,
  coachStyle: "teacher" as const,
  disclaimerAccepted: true,
};

async function setupUser() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  await saveOnboarding(row!.id, answers);
  return row!.id;
}

/** Aliment de test : 200 kcal pour 100 g, portion de 50 g. */
async function granola(userId: string) {
  return createCustomFood(userId, {
    name: "Granola maison",
    brand: "",
    basis: "100g",
    portionGrams: null,
    kcal: 200,
    proteinG: 10,
    carbsG: 25,
    fatG: 6,
  });
}

async function domainCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
}

describe("base d'aliments", () => {
  beforeEach(resetDatabase);

  it("trouve un aliment Ciqual malgré les accents et une faute de frappe", async () => {
    const userId = await setupUser();
    const exact = await searchFoods(userId, "pomme crue");
    expect(exact[0]?.nameFr).toMatch(/^Pomme/);
    const typo = await searchFoods(userId, "yahourt nature");
    expect(typo.some((food) => /^Yaourt/i.test(food.nameFr))).toBe(true);
    const accents = await searchFoods(userId, "CREME DE LAIT EPAISSE");
    expect(accents.some((food) => /^Crème de lait, 30% MG, épaisse/.test(food.nameFr))).toBe(true);
    // Les mots du quotidien retrouvent le nom Ciqual, avant les desserts.
    expect((await searchFoods(userId, "crème liquide"))[0]?.nameFr).toMatch(/^Crème de lait.*fluide/);
    expect((await searchFoods(userId, "crème fraîche"))[0]?.nameFr).toMatch(/^Crème de lait.*épaisse/);
  });

  it("garde les aliments personnels privés et les fait passer en premier", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    expect((await searchFoods(userId, "granola"))[0]?.id).toBe(id);
    const otherId = "00000000-0000-4000-8000-000000000000";
    expect(await searchFoods(otherId, "granola maison")).not.toContainEqual(expect.objectContaining({ id }));
    expect(await domainCode(getFood(otherId, id))).toBe("not_found");
  });

  it("calcule une recette pour 100 g et par portion", async () => {
    const userId = await setupUser();
    const base = await granola(userId);
    const recipeId = await createRecipe(userId, {
      name: "Bol du matin",
      servings: 2,
      cookedGrams: null,
      items: [{ foodId: base, grams: 300 }],
    });
    const recipe = await getFood(userId, recipeId);
    expect(recipe.kcal).toBe(200);
    expect(recipe.unitWeights).toEqual({ portion: 150 });
    expect(await domainCode(deleteOwnFood(userId, base))).toBe("food_in_recipe");
  });

  it("gère favoris et aliments récents", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    await setFavorite(userId, id, true);
    expect((await favoriteFoods(userId)).map((food) => food.id)).toEqual([id]);
    await setFavorite(userId, id, false);
    expect(await favoriteFoods(userId)).toEqual([]);
    await addEntry(userId, { date: todayIso(), slot: "breakfast", foodId: id, quantity: 50, unit: "g" });
    await addEntry(userId, { date: todayIso(), slot: "snack", foodId: id, quantity: 30, unit: "g" });
    // Un seul exemplaire par aliment, avec la dernière portion saisie (pour l'ajout en un geste).
    expect(await recentFoods(userId)).toEqual([
      expect.objectContaining({ id, lastQuantity: 30, lastUnit: "g", lastKcal: expect.any(Number) }),
    ]);
  });
});

describe("poids d'une tranche ou d'une pièce", () => {
  beforeEach(resetDatabase);

  it("se renseigne pour un produit sans portion et reste après une mise à jour depuis OFF", async () => {
    const userId = await setupUser();
    const product = {
      code: "3228857000166",
      name: "Brioche tranchée",
      brand: null,
      kcal: 332,
      proteinG: 8,
      carbsG: 50,
      fatG: 10,
      fiberG: null,
      sugarsG: null,
      saltG: null,
      nutriscore: null,
      novaGroup: null,
      fruitVegShare: 0,
      servingGrams: null,
      unitWeights: null,
      imageUrl: null,
    };
    const id = await cacheProduct(product);
    await setUnitWeight(userId, { foodId: id, unit: "slice", grams: 27 });
    await addEntry(userId, { date: todayIso(), slot: "breakfast", foodId: id, quantity: 2, unit: "slice" });
    expect((await entriesOn(userId, todayIso()))[0]).toMatchObject({ grams: 54 });

    // OFF ajoute plus tard une portion : la tranche saisie par la famille est gardée.
    await cacheProduct({ ...product, servingGrams: 50, unitWeights: { portion: 50 } });
    expect((await getFood(userId, id)).unitWeights).toEqual({ slice: 27, portion: 50 });
  });

  it("refuse un poids absurde", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    await expect(setUnitWeight(userId, { foodId: id, unit: "piece", grams: 0 })).rejects.toThrow();
  });
});

describe("journal", () => {
  beforeEach(resetDatabase);

  it("fige les valeurs à la saisie et les met à jour avec la quantité", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    const today = todayIso();
    const entryId = await addEntry(userId, { date: today, slot: "breakfast", foodId: id, quantity: 150, unit: "g" });
    let [entry] = await entriesOn(userId, today);
    expect(entry).toMatchObject({ grams: 150, kcal: 300, label: "Granola maison", inputMethod: "manual" });

    await updateEntry(userId, { id: entryId, quantity: 50, unit: "g", slot: "snack" });
    [entry] = await entriesOn(userId, today);
    expect(entry).toMatchObject({ grams: 50, kcal: 100, slot: "snack" });

    // Supprimer l'aliment ne réécrit pas l'historique.
    await deleteOwnFood(userId, id);
    [entry] = await entriesOn(userId, today);
    expect(entry).toMatchObject({ foodId: null, kcal: 100 });
    await updateEntry(userId, { id: entryId, quantity: 100, unit: "g", slot: "snack" });
    [entry] = await entriesOn(userId, today);
    expect(entry).toMatchObject({ grams: 100, kcal: 200 });
  });

  it("refuse les dates à venir, les unités inconnues et les quantités démesurées", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    const today = todayIso();
    const entry = { slot: "lunch" as const, foodId: id };
    expect(await domainCode(addEntry(userId, { ...entry, date: addDays(today, 1), quantity: 1, unit: "g" }))).toBe(
      "future_date",
    );
    expect(await domainCode(addEntry(userId, { ...entry, date: today, quantity: 1, unit: "ml" }))).toBe(
      "unit_not_available",
    );
    expect(await domainCode(addEntry(userId, { ...entry, date: today, quantity: 20, unit: "kg" }))).toBe(
      "quantity_too_large",
    );
  });

  it("n'agit que sur les lignes de l'utilisateur", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    const today = todayIso();
    const entryId = await addEntry(userId, { date: today, slot: "lunch", foodId: id, quantity: 100, unit: "g" });
    await deleteEntry("00000000-0000-4000-8000-000000000000", entryId);
    expect(await entriesOn(userId, today)).toHaveLength(1);
  });

  it("copie un repas ou la journée d'hier", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    const today = todayIso();
    const yesterday = addDays(today, -1);
    await addEntry(userId, { date: yesterday, slot: "breakfast", foodId: id, quantity: 50, unit: "g" });
    await addEntry(userId, { date: yesterday, slot: "dinner", foodId: id, quantity: 80, unit: "g" });

    expect(await copyEntries(userId, { fromDate: yesterday, fromSlot: "dinner", toDate: today, toSlot: null })).toBe(1);
    expect(await copyEntries(userId, { fromDate: yesterday, fromSlot: null, toDate: today, toSlot: null })).toBe(2);
    const copied = await entriesOn(userId, today);
    expect(copied).toHaveLength(3);
    expect(copied.every((entry) => entry.inputMethod === "copy")).toBe(true);
    expect(
      await domainCode(
        copyEntries(userId, { fromDate: addDays(today, -5), fromSlot: null, toDate: today, toSlot: null }),
      ),
    ).toBe("nothing_to_copy");
  });

  it("résume la journée : totaux, objectif, eau, zone et série", async () => {
    const userId = await setupUser();
    const id = await granola(userId);
    const today = todayIso();
    await addEntry(userId, { date: addDays(today, -1), slot: "lunch", foodId: id, quantity: 100, unit: "g" });
    await addEntry(userId, { date: today, slot: "lunch", foodId: id, quantity: 500, unit: "g" });
    await setWater(userId, today, 5);

    const summary = await daySummary(userId, today);
    expect(summary.totals.kcal).toBe(1000);
    expect(summary.bySlot.lunch.entries).toHaveLength(1);
    expect(summary.goal?.kcal).toBeGreaterThan(1000);
    expect(summary.water).toEqual({ glasses: 5, fromMeals: 0, goal: 8 });
    expect(summary.zone).toBe("loss");
    expect((await streakFor(userId, today)).days).toBe(2);

    // L'eau notée dans un repas s'ajoute aux verres du compteur, sans les modifier.
    const [water] = await searchFoods(userId, "eau du robinet");
    expect(water?.nameFr).toMatch(/^Eau du robinet/);
    await addEntry(userId, { date: today, slot: "lunch", foodId: water!.id, quantity: 500, unit: "ml" });
    expect((await daySummary(userId, today)).water).toEqual({ glasses: 7, fromMeals: 2, goal: 8 });
  });

  it("suit le poids avec une tendance lissée et l'exporte", async () => {
    const userId = await setupUser();
    const today = todayIso();
    for (let i = 13; i >= 0; i -= 1) {
      await setWeight(userId, { date: addDays(today, -i), weightKg: 82 - (13 - i) * 0.1 });
    }
    const overview = await weightOverview(userId);
    expect(overview.entries).toHaveLength(14);
    expect(overview.weeklyChangeKg).toBeLessThan(0);
    expect(overview.targetWeightKg).toBe(76);
    expect(await domainCode(setWeight(userId, { date: addDays(today, 1), weightKg: 80 }))).toBe("future_date");

    const data = await collectUserData(userId);
    expect(data.weights).toHaveLength(14);
  });
});

describe("Open Food Facts", () => {
  beforeEach(resetDatabase);
  afterEach(() => vi.unstubAllGlobals());

  const product = {
    code: "3017620422003",
    product_name_fr: "Pâte à tartiner test",
    brands: "Marque A, Marque B",
    serving_quantity: 15,
    nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
  };

  it("propose des produits complets et met en cache celui qui est choisi", async () => {
    const userId = await setupUser();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://search.openfoodfacts.org/search")) {
        const hit = { ...product, brands: ["Marque A", "Marque B"] };
        return Response.json({ hits: [hit, { code: "123456", product_name: "Sans valeurs" }] });
      }
      return Response.json({ product });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchOpenFoodFacts(userId, "pâte à tartiner");
    expect(results).toEqual([expect.objectContaining({ code: product.code, brand: "Marque A", servingGrams: 15 })]);

    const id = await importOpenFoodFactsProduct(userId, product.code);
    const again = await importOpenFoodFactsProduct(userId, product.code);
    expect(again).toBe(id);
    const cached = await getFood(userId, id);
    expect(cached).toMatchObject({ source: "off", kcal: 539, unitWeights: { portion: 15 } });
    const [row] = await db().select({ ref: foods.sourceRef }).from(foods).where(eq(foods.id, id));
    expect(row?.ref).toBe(product.code);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("world.openfoodfacts.org/api/v2/product/");
  });

  it("se replie sur l'ancienne recherche si le moteur de recherche ne répond pas", async () => {
    const userId = await setupUser();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://search.openfoodfacts.org")) return new Response("", { status: 503 });
      return Response.json({ products: [product] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const results = await searchOpenFoodFacts(userId, "pâte à tartiner");
    expect(results).toEqual([expect.objectContaining({ code: product.code, brand: "Marque A" })]);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("world.openfoodfacts.org/cgi/search.pl");
  });

  it("signale un produit incomplet ou un service indisponible", async () => {
    const userId = await setupUser();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ product: { product_name: "Vide" } })),
    );
    expect(await domainCode(importOpenFoodFactsProduct(userId, "1234567"))).toBe("off_incomplete");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    expect(await domainCode(searchOpenFoodFacts(userId, "biscuit"))).toBe("off_unavailable");
  });

  describe("code-barres", () => {
    it("lit le cache tant qu'il est récent, sinon relit OFF", async () => {
      const userId = await setupUser();
      const fetchMock = vi.fn(async () => Response.json({ product }));
      vi.stubGlobal("fetch", fetchMock);

      const id = await findByBarcode(userId, product.code);
      expect(await findByBarcode(userId, ` ${product.code} `)).toBe(id);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Cache vieux de 40 jours : relu sur OFF ; si OFF ne répond pas, le cache sert de secours.
      await db()
        .update(foods)
        .set({ fetchedAt: new Date(Date.now() - 40 * 86_400_000) })
        .where(eq(foods.id, id));
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("", { status: 503 })),
      );
      expect(await findByBarcode(userId, product.code)).toBe(id);
    });

    it("garde la photo OFF du produit, et seulement si elle vient d'Open Food Facts", async () => {
      const userId = await setupUser();
      const image = "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.4.200.jpg";
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ product: { ...product, image_front_small_url: image } })),
      );
      const id = await findByBarcode(userId, product.code);
      expect((await getFoodDetails(userId, id)).imageUrl).toBe(image);

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ product: { ...product, image_front_small_url: "http://example.org/x.jpg" } }),
        ),
      );
      await importOpenFoodFactsProduct(userId, product.code);
      expect((await getFoodDetails(userId, id)).imageUrl).toBeNull();
    });

    it("signale un code invalide ou un produit inconnu", async () => {
      const userId = await setupUser();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ status: 0 }, { status: 404 })),
      );
      expect(await domainCode(findByBarcode(userId, "3017620422004"))).toBe("invalid_barcode");
      expect(await domainCode(findByBarcode(userId, "4006381333931"))).toBe("barcode_not_found");
    });

    it("note la saisie par code-barres dans le journal", async () => {
      const userId = await setupUser();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ product })),
      );
      const id = await findByBarcode(userId, product.code);
      await addEntry(userId, {
        date: todayIso(),
        slot: "snack",
        foodId: id,
        quantity: 1,
        unit: "portion",
        inputMethod: "barcode",
      });
      const [entry] = await entriesOn(userId, todayIso());
      expect(entry).toMatchObject({ inputMethod: "barcode", grams: 15, label: "Pâte à tartiner test (Marque A)" });
    });
  });
});
