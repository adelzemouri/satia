import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { foods, llmCalls, mealEntries, savedMeals, sharedMealShares, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { acceptInvite, createAccessLink, setupFirstAdmin } from "@/server/accounts";
import { createSharedMeal, otherMembers, pendingShares, respondToShare, shareSavedMeal } from "@/server/family";
import {
  createCustomFood,
  createRecipe,
  familyRecipes,
  fillRecipePhotos,
  getFood,
  getRecipeForEdit,
  ownFoods,
  recipePhotoUrl,
  isGeneratedRecipePhoto,
  regenerateRecipePhoto,
  searchFoods,
  setRecipePhoto,
  updateRecipe,
} from "@/server/foods";

import { setAiSettings } from "@/server/settings";

import { resetDatabase } from "./helpers";

async function setupFamily() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [admin] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  const token = await createAccessLink({
    kind: "invite",
    householdId: admin!.householdId,
    createdBy: admin!.id,
    role: "member",
    label: "Léo",
  });
  await acceptInvite({ token, name: "Léo", email: "leo@example.com", password: "mot-de-passe-de-leo" });
  const [member] = await db().select().from(user).where(eq(user.email, "leo@example.com"));
  return { admin: admin!, member: member! };
}

/** Invité dans un foyer à part : il ne voit rien de la famille. */
async function createOutsider(admin: { id: string; householdId: string }) {
  const token = await createAccessLink({
    kind: "invite",
    householdId: admin.householdId,
    createdBy: admin.id,
    role: "member",
    label: "Zoé",
    separateHousehold: true,
  });
  await acceptInvite({ token, name: "Zoé", email: "zoe@example.com", password: "mot-de-passe-de-zoe" });
  const [outsider] = await db().select().from(user).where(eq(user.email, "zoe@example.com"));
  return outsider!.id;
}

async function firstFood(userId: string, query: string) {
  const [food] = await searchFoods(userId, query);
  if (!food) throw new Error(`aliment introuvable : ${query}`);
  return food;
}

/** Lasagnes du foyer : 1 200 g pour 6 portions. */
async function familyLasagna(userId: string) {
  const pasta = await firstFood(userId, "pâtes cuites");
  const cheese = await firstFood(userId, "emmental râpé");
  return createRecipe(userId, {
    name: "Lasagnes de la maison",
    servings: 6,
    cookedGrams: 1200,
    items: [
      { foodId: pasta.id, grams: 800 },
      { foodId: cheese.id, grams: 150 },
    ],
  });
}

/** Plus petit JPEG accepté par la vérification de signature. */
const JPEG_BASE64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

describe("espace famille", () => {
  beforeEach(resetDatabase);

  describe("photos générées par l'IA", () => {
    beforeEach(() => vi.stubEnv("LLM_PROVIDER", "mock"));
    afterEach(() => vi.unstubAllEnvs());

    it("une recette du foyer sans photo en reçoit une, une seule fois, sans écraser celle de la famille", async () => {
      const { admin, member } = await setupFamily();
      const lasagnaId = await familyLasagna(admin.id);
      expect(await fillRecipePhotos(member.id)).toBe(1);
      const [row] = await db().select().from(foods).where(eq(foods.id, lasagnaId));
      expect(isGeneratedRecipePhoto(row!.photoKey!)).toBe(true);
      expect(row!.imageUrl).toMatch(new RegExp(`^/api/foods/${lasagnaId}/photo`));
      const calls = await db().select().from(llmCalls);
      expect(calls).toMatchObject([{ feature: "recipe_image", status: "ok", costUsdMicros: 70_000 }]);
      // Déjà illustrée : aucun nouvel appel.
      expect(await fillRecipePhotos(admin.id)).toBe(0);

      // Photo ratée : on la refait, avec une nouvelle adresse.
      await regenerateRecipePhoto(admin.id, lasagnaId);
      const [redone] = await db().select().from(foods).where(eq(foods.id, lasagnaId));
      expect(isGeneratedRecipePhoto(redone!.photoKey!)).toBe(true);
      expect(redone!.photoKey).not.toBe(row!.photoKey);
      expect(redone!.imageUrl).not.toBe(row!.imageUrl);

      // La photo de la famille remplace celle de l'IA, et n'est jamais remplacée automatiquement.
      await setRecipePhoto(member.id, { foodId: lasagnaId, imageBase64: JPEG_BASE64, mime: "image/jpeg" });
      const [mine] = await db().select().from(foods).where(eq(foods.id, lasagnaId));
      expect(isGeneratedRecipePhoto(mine!.photoKey!)).toBe(false);
      expect(await fillRecipePhotos(admin.id)).toBe(0);
      // Refaire la photo est réservé à l'admin (chaque image coûte), qui peut le faire sur toutes les recettes.
      await expect(regenerateRecipePhoto(member.id, lasagnaId)).rejects.toThrow("forbidden");
      await regenerateRecipePhoto(admin.id, lasagnaId);
      const [again] = await db().select().from(foods).where(eq(foods.id, lasagnaId));
      expect(isGeneratedRecipePhoto(again!.photoKey!)).toBe(true);
    });

    it("l'admin refait la photo d'une recette du catalogue, vue par toute la famille", async () => {
      const { admin, member } = await setupFamily();
      const [recipe] = await db()
        .select()
        .from(foods)
        .where(and(eq(foods.source, "recipe"), eq(foods.sourceRef, "catalog:minestrone")));
      expect(recipe!.imageUrl).toBe("/recipes/minestrone-480.webp");
      await expect(regenerateRecipePhoto(member.id, recipe!.id)).rejects.toThrow("forbidden");
      await regenerateRecipePhoto(admin.id, recipe!.id);
      const [redone] = await db().select().from(foods).where(eq(foods.id, recipe!.id));
      expect(redone!.photoKey).toMatch(/^recipes\/catalog\/ai-/);
      expect(redone!.imageUrl).toMatch(new RegExp(`^/api/foods/${recipe!.id}/photo\\?v=`));
      expect(await recipePhotoUrl(member.id, recipe!.id)).toMatch(/^https?:\/\//);
    });

    it("IA en pause : pas de photo, nouvel essai plus tard", async () => {
      const { admin } = await setupFamily();
      const lasagnaId = await familyLasagna(admin.id);
      await setAiSettings({ enabled: false, monthlyBudgetUsd: null });
      expect(await fillRecipePhotos(admin.id)).toBe(0);
      await setAiSettings({ enabled: true, monthlyBudgetUsd: null });
      // La tentative est notée : on n'essaie pas à chaque visite.
      expect(await fillRecipePhotos(admin.id)).toBe(0);
      await db()
        .update(foods)
        .set({ photoAttemptedAt: new Date(Date.now() - 8 * 86_400_000) })
        .where(eq(foods.id, lasagnaId));
      expect(await fillRecipePhotos(admin.id)).toBe(1);
    });
  });

  it("photo d'une recette : visible par la famille, privée hors du foyer, remplaçable", async () => {
    const { admin, member } = await setupFamily();
    const lasagnaId = await familyLasagna(admin.id);
    await setRecipePhoto(admin.id, { foodId: lasagnaId, imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    const seen = await getFood(member.id, lasagnaId);
    expect(seen.imageUrl).toMatch(new RegExp(`^/api/foods/${lasagnaId}/photo\\?v=`));
    expect(await recipePhotoUrl(member.id, lasagnaId)).toMatch(/^https?:\/\//);

    // Le membre change la photo : nouvelle adresse, pour que les téléphones ne gardent pas l'ancienne.
    await setRecipePhoto(member.id, { foodId: lasagnaId, imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    expect((await getFood(admin.id, lasagnaId)).imageUrl).not.toBe(seen.imageUrl);
    await expect(
      setRecipePhoto(member.id, { foodId: lasagnaId, imageBase64: "bm9wZQ==", mime: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "invalid_photo" });

    // Hors du foyer, la photo reste privée.
    const outsider = await createOutsider(admin);
    expect(await recipePhotoUrl(outsider, lasagnaId)).toBeNull();
    await expect(
      setRecipePhoto(outsider, { foodId: lasagnaId, imageBase64: JPEG_BASE64, mime: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "not_found" });
    const rice = await firstFood(admin.id, "riz basmati cuit");
    // Un aliment qui n'est pas une recette n'a pas de photo de famille.
    await expect(
      setRecipePhoto(admin.id, { foodId: rice.id, imageBase64: JPEG_BASE64, mime: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("toute recette est visible et modifiable par chaque membre du foyer, pas au-delà", async () => {
    const { admin, member } = await setupFamily();
    const lasagnaId = await familyLasagna(admin.id);
    const outsider = await createOutsider(admin);

    expect((await familyRecipes(member.id)).map((food) => food.id)).toEqual([lasagnaId]);
    expect((await searchFoods(member.id, "lasagnes maison"))[0]?.id).toBe(lasagnaId);
    await expect(getFood(outsider, lasagnaId)).rejects.toMatchObject({ code: "not_found" });

    const recipe = await getRecipeForEdit(member.id, lasagnaId);
    expect(recipe).toMatchObject({ name: "Lasagnes de la maison", servings: 6, cookedGrams: 1200 });
    await updateRecipe(member.id, lasagnaId, {
      name: "Lasagnes de mamie",
      servings: 8,
      cookedGrams: 1200,
      items: recipe.items.map((item) => ({ foodId: item.food.id, grams: item.grams })),
    });
    const updated = await getFood(admin.id, lasagnaId);
    expect(updated).toMatchObject({ nameFr: "Lasagnes de mamie", servings: 8, unitWeights: { portion: 150 } });
    expect(updated.householdId).toBe(admin.householdId);
    await expect(getRecipeForEdit(outsider, lasagnaId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("un aliment perso devient commun en entrant dans une recette", async () => {
    const { admin, member } = await setupFamily();
    const own = await createCustomFood(admin.id, {
      name: "Sauce secrète",
      basis: "100g",
      portionGrams: null,
      kcal: 200,
      proteinG: 2,
      carbsG: 10,
      fatG: 16,
    });
    const other = await createCustomFood(admin.id, {
      name: "Granola d'Adel",
      basis: "100g",
      portionGrams: null,
      kcal: 450,
      proteinG: 10,
      carbsG: 60,
      fatG: 18,
    });
    await expect(getFood(member.id, own)).rejects.toMatchObject({ code: "not_found" });

    const id = await createRecipe(admin.id, {
      name: "Plat en sauce",
      servings: 2,
      cookedGrams: null,
      items: [{ foodId: own, grams: 100 }],
    });
    expect(await getFood(member.id, own)).toMatchObject({ ownerUserId: null, householdId: admin.householdId });
    // L'autre membre peut modifier la recette : il voit tous ses ingrédients.
    const recipe = await getRecipeForEdit(member.id, id);
    await updateRecipe(member.id, id, {
      name: "Plat en sauce",
      servings: 3,
      cookedGrams: null,
      items: recipe.items.map((item) => ({ foodId: item.food.id, grams: item.grams })),
    });
    // Les aliments perso hors recette restent privés.
    await expect(getFood(member.id, other)).rejects.toMatchObject({ code: "not_found" });
    expect((await ownFoods(admin.id)).map((food) => food.nameFr)).toEqual([
      "Granola d'Adel",
      "Sauce secrète",
    ]);
    expect((await familyRecipes(member.id)).map((food) => food.nameFr)).toEqual(["Plat en sauce"]);
  });

  it("repas partagé : l'auteur l'ajoute tout de suite, les autres valident avec leur portion", async () => {
    const { admin, member } = await setupFamily();
    const lasagnaId = await familyLasagna(admin.id);
    expect(await otherMembers(admin.id, admin.householdId)).toEqual([{ id: member.id, name: "Léo" }]);

    const mealId = await createSharedMeal(admin.id, admin.householdId, {
      foodId: lasagnaId,
      date: todayIso(),
      slot: "dinner",
      totalParts: 4,
      totalGrams: null,
      memberIds: [member.id],
      myParts: 1,
    });
    const [adminEntry] = await db().select().from(mealEntries).where(eq(mealEntries.userId, admin.id));
    expect(adminEntry).toMatchObject({
      grams: 300,
      slot: "dinner",
      inputMethod: "shared",
      label: "Lasagnes de la maison",
    });

    // Rien dans le journal du membre tant qu'il n'a pas validé.
    expect(await db().select().from(mealEntries).where(eq(mealEntries.userId, member.id))).toHaveLength(0);
    expect(await pendingShares(admin.id)).toEqual([]);
    const [pending] = await pendingShares(member.id);
    expect(pending).toMatchObject({
      sharedMealId: mealId,
      dishName: "Lasagnes de la maison",
      fromName: "Adel",
      slot: "dinner",
      totalParts: 4,
      partGrams: 300,
    });
    expect(pending!.partKcal).toBe(Math.round((adminEntry!.kcal / 300) * 300));

    await respondToShare(member.id, mealId, { accept: true, parts: 1.5, grams: null, slot: "lunch" });
    const [memberEntry] = await db().select().from(mealEntries).where(eq(mealEntries.userId, member.id));
    expect(memberEntry).toMatchObject({ grams: 450, slot: "lunch", inputMethod: "shared" });
    expect(await pendingShares(member.id)).toEqual([]);
    const [share] = await db()
      .select()
      .from(sharedMealShares)
      .where(and(eq(sharedMealShares.sharedMealId, mealId), eq(sharedMealShares.userId, member.id)));
    expect(share).toMatchObject({ status: "accepted", entryId: memberEntry!.id });

    // Une seule réponse par membre.
    await expect(respondToShare(member.id, mealId, { accept: false })).rejects.toMatchObject({ code: "not_found" });
  });

  it("partage un repas de « Mes repas » : le membre choisit sa portion, ses lignes suivent", async () => {
    const { admin, member } = await setupFamily();
    const pasta = await firstFood(admin.id, "pâtes cuites");
    const sauce = await createCustomFood(admin.id, {
      name: "Sauce secrète",
      basis: "100g",
      portionGrams: null,
      kcal: 200,
      proteinG: 2,
      carbsG: 10,
      fatG: 16,
    });
    const line = { unit: "g" as const, isEstimated: false };
    const [saved] = await db()
      .insert(savedMeals)
      .values({
        userId: admin.id,
        name: "Pâtes au saumon",
        items: [
          {
            ...line,
            foodId: pasta.id,
            label: "Pâtes",
            quantity: 300,
            grams: 300,
            kcal: 450,
            proteinG: 15,
            carbsG: 90,
            fatG: 3,
          },
          {
            ...line,
            foodId: sauce,
            label: "Sauce secrète",
            quantity: 100,
            grams: 100,
            kcal: 200,
            proteinG: 2,
            carbsG: 10,
            fatG: 16,
          },
        ],
      })
      .returning({ id: savedMeals.id });

    // Seul l'auteur peut partager son repas, et pas à un jour à venir.
    await expect(
      shareSavedMeal(member.id, member.householdId, {
        id: saved!.id,
        date: todayIso(),
        slot: "lunch",
        memberIds: [admin.id],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    const sharedId = await shareSavedMeal(admin.id, admin.householdId, {
      id: saved!.id,
      date: todayIso(),
      slot: "lunch",
      memberIds: [member.id],
    });
    // Rien n'entre dans le journal de l'auteur (le repas y est déjà).
    expect(await db().select().from(mealEntries)).toHaveLength(0);
    const [pending] = await pendingShares(member.id);
    expect(pending).toMatchObject({
      kind: "meal",
      sharedMealId: sharedId,
      dishName: "Pâtes au saumon",
      fromName: "Adel",
      totalParts: 1,
      partGrams: 400,
      partKcal: 650,
    });

    await respondToShare(member.id, sharedId, { accept: true, parts: 0.5, grams: null, slot: "dinner" });
    const entries = await db().select().from(mealEntries).where(eq(mealEntries.userId, member.id));
    expect(entries.map((entry) => [entry.label, entry.grams, entry.kcal, entry.dish, entry.slot])).toEqual([
      ["Pâtes", 150, 225, "Pâtes au saumon", "dinner"],
      ["Sauce secrète", 50, 100, "Pâtes au saumon", "dinner"],
    ]);
    // L'aliment perso de l'auteur reste privé : la ligne garde ses valeurs, sans lien.
    expect(entries.map((entry) => entry.foodId)).toEqual([pasta.id, null]);
  });

  it("un membre peut refuser, ou choisir sa portion en grammes", async () => {
    const { admin, member } = await setupFamily();
    const lasagnaId = await familyLasagna(admin.id);
    const share = () =>
      createSharedMeal(admin.id, admin.householdId, {
        foodId: lasagnaId,
        date: todayIso(),
        slot: "lunch",
        totalParts: 6,
        totalGrams: 1200,
        memberIds: [member.id],
        myParts: null,
      });
    const declined = await share();
    await respondToShare(member.id, declined, { accept: false });
    const byGrams = await share();
    await respondToShare(member.id, byGrams, { accept: true, parts: null, grams: 250, slot: "lunch" });
    const entries = await db().select().from(mealEntries);
    expect(entries.map((entry) => [entry.userId, entry.grams])).toEqual([[member.id, 250]]);
  });

  it("refuse un aliment personnel partagé, un jour à venir ou un partage sans personne", async () => {
    const { admin, member } = await setupFamily();
    const rice = await firstFood(admin.id, "riz basmati cuit");
    const personal = await createCustomFood(admin.id, {
      name: "Riz perso",
      basis: "100g",
      portionGrams: null,
      kcal: 130,
      proteinG: 3,
      carbsG: 28,
      fatG: 0,
    });
    const base = { date: todayIso(), slot: "dinner" as const, totalParts: 2, totalGrams: null, myParts: 1 };
    await expect(
      createSharedMeal(admin.id, admin.householdId, {
        ...base,
        foodId: personal,
        totalGrams: 300,
        memberIds: [member.id],
      }),
    ).rejects.toMatchObject({ code: "dish_not_shared" });
    const lasagnaId = await familyLasagna(admin.id);
    await expect(
      createSharedMeal(admin.id, admin.householdId, {
        ...base,
        foodId: lasagnaId,
        date: addDays(todayIso(), 1),
        memberIds: [member.id],
      }),
    ).rejects.toMatchObject({ code: "future_date" });
    await expect(
      createSharedMeal(admin.id, admin.householdId, { ...base, foodId: lasagnaId, memberIds: [], myParts: null }),
    ).rejects.toMatchObject({ code: "share_nobody" });
    // Un aliment sans poids connu demande le poids du plat entier.
    await expect(
      createSharedMeal(admin.id, admin.householdId, { ...base, foodId: rice.id, memberIds: [member.id] }),
    ).rejects.toMatchObject({ code: "dish_weight_required" });
  });
});
