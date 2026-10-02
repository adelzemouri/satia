import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { mealEntries, sharedMealShares, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { acceptInvite, createAccessLink, setupFirstAdmin } from "@/server/accounts";
import { createSharedMeal, otherMembers, pendingShares, respondToShare } from "@/server/family";
import {
  createCustomFood,
  createRecipe,
  familyRecipes,
  getFood,
  getRecipeForEdit,
  searchFoods,
  updateRecipe,
} from "@/server/foods";

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
    family: true,
  });
}

describe("espace famille", () => {
  beforeEach(resetDatabase);

  it("une recette du foyer est visible et modifiable par chaque membre ; une recette perso reste privée", async () => {
    const { admin, member } = await setupFamily();
    const lasagnaId = await familyLasagna(admin.id);
    const rice = await firstFood(admin.id, "riz basmati cuit");
    const privateId = await createRecipe(admin.id, {
      name: "Riz d'Adel",
      servings: 1,
      cookedGrams: null,
      items: [{ foodId: rice.id, grams: 200 }],
    });

    expect((await familyRecipes(member.id)).map((food) => food.id)).toEqual([lasagnaId]);
    expect((await searchFoods(member.id, "lasagnes maison"))[0]?.id).toBe(lasagnaId);
    await expect(getFood(member.id, privateId)).rejects.toMatchObject({ code: "not_found" });

    const recipe = await getRecipeForEdit(member.id, lasagnaId);
    expect(recipe).toMatchObject({ name: "Lasagnes de la maison", servings: 6, family: true, cookedGrams: 1200 });
    await updateRecipe(member.id, lasagnaId, {
      name: "Lasagnes de mamie",
      servings: 8,
      cookedGrams: 1200,
      items: recipe.items.map((item) => ({ foodId: item.food.id, grams: item.grams })),
      // Une recette du foyer le reste, même si on décoche.
      family: false,
    });
    const updated = await getFood(admin.id, lasagnaId);
    expect(updated).toMatchObject({ nameFr: "Lasagnes de mamie", servings: 8, unitWeights: { portion: 150 } });
    expect(updated.householdId).toBe(admin.householdId);
    await expect(getRecipeForEdit(member.id, privateId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuse un aliment personnel dans une recette du foyer, et rend commune une recette perso", async () => {
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
    await expect(
      createRecipe(admin.id, {
        name: "Plat",
        servings: 2,
        cookedGrams: null,
        items: [{ foodId: own, grams: 100 }],
        family: true,
      }),
    ).rejects.toMatchObject({ code: "family_recipe_personal_ingredient" });

    const rice = await firstFood(admin.id, "riz basmati cuit");
    const id = await createRecipe(admin.id, {
      name: "Riz du dimanche",
      servings: 4,
      cookedGrams: null,
      items: [{ foodId: rice.id, grams: 600 }],
    });
    await updateRecipe(admin.id, id, {
      name: "Riz du dimanche",
      servings: 4,
      cookedGrams: null,
      items: [{ foodId: rice.id, grams: 600 }],
      family: true,
    });
    expect((await familyRecipes(member.id)).map((food) => food.nameFr)).toEqual(["Riz du dimanche"]);
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

  it("refuse un plat personnel partagé, un jour à venir ou un partage sans personne", async () => {
    const { admin, member } = await setupFamily();
    const rice = await firstFood(admin.id, "riz basmati cuit");
    const personal = await createRecipe(admin.id, {
      name: "Riz perso",
      servings: 2,
      cookedGrams: null,
      items: [{ foodId: rice.id, grams: 300 }],
    });
    const base = { date: todayIso(), slot: "dinner" as const, totalParts: 2, totalGrams: null, myParts: 1 };
    await expect(
      createSharedMeal(admin.id, admin.householdId, { ...base, foodId: personal, memberIds: [member.id] }),
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
