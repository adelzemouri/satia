import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { foodCorrections, foods, llmCalls, mealEntries, photos, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { setProviderForTests } from "@/llm/providers";
import type { LlmProvider } from "@/llm/types";
import { acceptInvite, createAccessLink, setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { createRecipe, searchFoods, setUnitWeight } from "@/server/foods";
import { analyzePhoto, analyzeText, saveMeal } from "@/server/meal-ai";
import { createContainer, listContainers, saveExpression } from "@/server/personal";
import { lastPhotoPurge, purgePhotos, purgePhotosIfDue, runPhotoPurge } from "@/server/photos";
import { setAiSettings, setPhotoSettings } from "@/server/settings";

import { resetDatabase } from "./helpers";

async function setupUser(email = "adel@example.com") {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email,
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, email));
  return row!.id;
}

async function firstFood(userId: string, query: string) {
  const [food] = await searchFoods(userId, query);
  if (!food) throw new Error(`aliment introuvable : ${query}`);
  return food;
}

/** Plus petit JPEG accepté par la vérification de signature (le fournisseur simulé ne le lit pas). */
const JPEG_BASE64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

/** Fournisseur scripté : une réponse par appel, dans l'ordre. */
function scripted(...responses: unknown[]): LlmProvider {
  return {
    name: "script",
    async complete() {
      return { json: responses.shift(), usage: { inputTokens: 100, outputTokens: 20 } };
    },
  };
}

const callCount = async () => (await db().select().from(llmCalls)).length;

describe("saisie IA", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubEnv("LLM_PROVIDER", "mock");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setProviderForTests(null);
  });

  it("texte libre : le LLM nomme les aliments, la base locale fournit les valeurs", async () => {
    const userId = await setupUser();
    const draft = await analyzeText(userId, { text: "un bol de riz et du poulet", method: "text" });
    expect(draft).toMatchObject({ method: "text", photoId: null, usedAi: true });
    expect(draft.items).toHaveLength(2);
    const [rice, chicken] = draft.items;
    expect(rice).toMatchObject({ label: "riz basmati cuit", aiLabel: "riz basmati cuit", quantity: 180, unit: "g" });
    expect(rice!.food?.nameFr).toMatch(/^Riz basmati, cuit/);
    expect(rice!.estimate).toBeNull();
    expect(rice!.proposal).toEqual({ foodId: rice!.food!.id, grams: 180 });
    expect(chicken!.food?.nameFr).toMatch(/poulet/i);
    const [call] = await db().select().from(llmCalls);
    expect(call).toMatchObject({ feature: "meal_text", model: "mock-text", status: "ok" });
  });

  it("enregistre le repas confirmé, puis les corrections répétées deviennent des habitudes", async () => {
    const userId = await setupUser();
    const draft = await analyzeText(userId, { text: "riz", method: "voice" });
    const rice = draft.items[0]!;
    const white = await firstFood(userId, "riz blanc cuit");
    expect(white.id).not.toBe(rice.food!.id);
    const save = (grams: number) =>
      saveMeal(userId, {
        date: todayIso(),
        slot: "lunch",
        method: "voice",
        photoId: null,
        items: [
          {
            foodId: white.id,
            estimate: null,
            quantity: grams,
            unit: "g",
            aiLabel: rice.aiLabel,
            proposal: rice.proposal,
          },
        ],
      });
    expect(await save(200)).toBe(1);
    await save(220);
    const entries = await db().select().from(mealEntries).where(eq(mealEntries.userId, userId));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ foodId: white.id, inputMethod: "voice", grams: 200, isEstimated: false });
    expect(await db().select().from(foodCorrections)).toHaveLength(2);

    // L'habitude « riz basmati cuit → riz blanc, 210 g » s'applique sans appel au LLM.
    const calls = await callCount();
    const local = await analyzeText(userId, { text: "riz basmati cuit", method: "text" });
    expect(local.usedAi).toBe(false);
    expect(local.items[0]).toMatchObject({ quantity: 210, unit: "g", proposal: { foodId: white.id, grams: 210 } });
    expect(local.items[0]!.food!.id).toBe(white.id);
    expect(await callCount()).toBe(calls);

    // Et elle remplace l'aliment proposé quand le LLM reconnaît ce nom.
    const viaAi = await analyzeText(userId, { text: "une assiette de riz", method: "text" });
    expect(viaAi.usedAi).toBe(true);
    expect(viaAi.items[0]!.food!.id).toBe(white.id);
  });

  it("le dictionnaire personnel est reconnu sans appel, même quand l'IA est en pause", async () => {
    const userId = await setupUser();
    const bread = await firstFood(userId, "pain de mie courant");
    const coffee = await firstFood(userId, "café prêt à boire");
    await saveExpression(userId, { phrase: "Ma tartine", foodId: bread.id, quantity: 30, unit: "g" });
    await saveExpression(userId, { phrase: "mon café du matin", foodId: coffee.id, quantity: 200, unit: "g" });
    await setAiSettings({ enabled: false, monthlyBudgetUsd: null });

    const draft = await analyzeText(userId, { text: "2 ma tartine et mon café du matin", method: "voice" });
    expect(draft.usedAi).toBe(false);
    expect(draft.items.map((item) => [item.food?.id, item.quantity, item.unit, item.proposal])).toEqual([
      [bread.id, 60, "g", null],
      [coffee.id, 200, "g", null],
    ]);
    expect(await callCount()).toBe(0);
    await expect(analyzeText(userId, { text: "une banane", method: "text" })).rejects.toMatchObject({
      reason: "disabled",
    });
  });

  it("des pièces comptées par l'IA s'affichent en pièces si l'aliment a un poids à la pièce", async () => {
    const userId = await setupUser();
    const [croque] = await searchFoods(userId, "croque-monsieur");
    // Les aliments Ciqual survivent à la remise à zéro : on repart sans poids à la pièce.
    await db().update(foods).set({ unitWeights: null }).where(eq(foods.id, croque!.id));
    const reply = { items: [{ name: "croque-monsieur", grams: 300, count: 2, confidence: 0.8 }] };
    setProviderForTests(scripted(reply));
    // Sans poids à la pièce : le poids total en grammes, avec le nombre de pièces pour l'expliquer.
    const byWeight = (await analyzeText(userId, { text: "deux croque-monsieur", method: "text" })).items[0]!;
    expect(byWeight).toMatchObject({ quantity: 300, unit: "g", count: 2 });

    await setUnitWeight(userId, { foodId: croque!.id, unit: "piece", grams: 150 });
    setProviderForTests(scripted(reply));
    const byPiece = (await analyzeText(userId, { text: "deux croque-monsieur", method: "text" })).items[0]!;
    expect(byPiece).toMatchObject({ quantity: 2, unit: "piece", proposal: { grams: 300 } });
    await db().update(foods).set({ unitWeights: croque!.unitWeights }).where(eq(foods.id, croque!.id));
  });

  it("regroupe les aliments par plat et garde des quantités réalistes", async () => {
    const userId = await setupUser();
    setProviderForTests(
      scripted({
        items: [
          { name: "pâtes cuites", dish: "Pâtes au saumon", grams: 200, confidence: 0.8 },
          { name: "saumon cuit", dish: "Pâtes au saumon", grams: 100, confidence: 0.7 },
          { name: "laitue crue", dish: "Salade verte", grams: 60, confidence: 0.8 },
          { name: "vinaigre balsamique", dish: "Salade verte", grams: 100, confidence: 0.6 },
        ],
      }),
    );
    const draft = await analyzeText(userId, { text: "pâtes au saumon et une salade au balsamique", method: "voice" });
    expect(draft.items.map((item) => [item.dish, item.quantity])).toEqual([
      ["Pâtes au saumon", 200],
      ["Pâtes au saumon", 100],
      ["Salade verte", 60],
      // 100 g de balsamique ramenés à une portion habituelle.
      ["Salade verte", 10],
    ]);
    await saveMeal(userId, {
      date: todayIso(),
      slot: "lunch",
      method: "voice",
      photoId: null,
      items: draft.items.map((item) => ({
        foodId: item.food!.id,
        estimate: null,
        quantity: item.quantity,
        unit: item.unit,
        aiLabel: item.aiLabel,
        dish: item.dish,
        proposal: item.proposal,
      })),
    });
    const saved = await db().select().from(mealEntries).where(eq(mealEntries.userId, userId));
    expect(saved.map((entry) => entry.dish).sort()).toEqual([
      "Pâtes au saumon",
      "Pâtes au saumon",
      "Salade verte",
      "Salade verte",
    ]);
  });

  it("ne prend pas une recette qui contient seulement l'aliment reconnu", async () => {
    const userId = await setupUser();
    const peanut = await firstFood(userId, "beurre de cacahuete");
    const muesli = await firstFood(userId, "muesli");
    await createRecipe(userId, {
      name: "Fromage blanc, müesli et beurre de cacahuète",
      servings: 1,
      cookedGrams: null,
      items: [
        { foodId: peanut.id, grams: 15 },
        { foodId: muesli.id, grams: 40 },
      ],
    });
    setProviderForTests(
      scripted({
        items: [
          { name: "beurre de cacahuète", grams: 15, confidence: 0.8 },
          { name: "fromage blanc, müesli et beurre de cacahuète", grams: 200, confidence: 0.8 },
        ],
      }),
    );
    const draft = await analyzeText(userId, { text: "tartine beurre de cacahuète et mon bol", method: "text" });
    expect(draft.items[0]!.food).toMatchObject({ source: "ciqual" });
    expect(draft.items[0]!.food!.nameFr).toMatch(/^Beurre de cacahu/);
    // Nommée en entier, la recette du foyer reste retenue.
    expect(draft.items[1]!.food).toMatchObject({ source: "recipe" });
  });

  it("estime les valeurs d'un aliment absent de la base et les marque « estimé »", async () => {
    const userId = await setupUser();
    setProviderForTests(
      scripted(
        { items: [{ name: "zqxw plat imaginaire", grams: 250, confidence: 0.4 }] },
        { items: [{ name: "zqxw plat imaginaire", kcal: 180, proteinG: 8, carbsG: 20, fatG: 7 }] },
      ),
    );
    const draft = await analyzeText(userId, { text: "un plat imaginaire", method: "text" });
    const item = draft.items[0]!;
    expect(item.food).toBeNull();
    expect(item.estimate).toEqual({ name: "zqxw plat imaginaire", kcal: 180, proteinG: 8, carbsG: 20, fatG: 7 });
    expect((await db().select().from(llmCalls)).map((call) => call.feature).sort()).toEqual(["estimate", "meal_text"]);

    await saveMeal(userId, {
      date: todayIso(),
      slot: "dinner",
      method: "text",
      photoId: null,
      items: [
        {
          foodId: null,
          estimate: item.estimate,
          quantity: 250,
          unit: "g",
          aiLabel: item.aiLabel,
          proposal: item.proposal,
        },
      ],
    });
    const [entry] = await db().select().from(mealEntries);
    expect(entry).toMatchObject({
      foodId: null,
      label: "zqxw plat imaginaire",
      grams: 250,
      kcal: 450,
      isEstimated: true,
    });
    // Rien à apprendre d'une ligne sans aliment de la base.
    expect(await db().select().from(foodCorrections)).toHaveLength(0);
  });

  it("photo : analyse, stockage privé, lien avec le repas, contenant transmis au LLM", async () => {
    const userId = await setupUser();
    await createContainer(userId, { name: "Grand bol", kind: "bowl", volumeMl: 500, diameterCm: null });
    const [bowl] = await listContainers(userId);
    const prompts: string[] = [];
    setProviderForTests({
      name: "spy",
      async complete(request) {
        prompts.push(request.user);
        return {
          json: { items: [{ name: "riz basmati cuit", grams: 150, confidence: 0.9 }] },
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    });
    const draft = await analyzePhoto(userId, {
      imageBase64: JPEG_BASE64,
      mime: "image/jpeg",
      note: "sauce à part",
      containerId: bowl!.id,
    });
    expect(prompts[0]).toBe("Analyse cette photo.\nPrécision : sauce à part\nContenants : Grand bol (bol, 500 ml)");
    expect(draft.method).toBe("photo");
    expect(draft.photoId).toBeTruthy();
    const [photo] = await db().select().from(photos);
    expect(photo).toMatchObject({ id: draft.photoId, userId });
    expect(photo!.objectKey).toMatch(new RegExp(`^meals/${userId}/.+\\.jpg$`));

    const item = draft.items[0]!;
    await saveMeal(userId, {
      date: todayIso(),
      slot: "lunch",
      method: "photo",
      photoId: draft.photoId,
      items: [
        {
          foodId: item.food!.id,
          estimate: null,
          quantity: 150,
          unit: "g",
          aiLabel: item.aiLabel,
          proposal: item.proposal,
        },
      ],
    });
    const [entry] = await db().select().from(mealEntries);
    expect(entry).toMatchObject({ photoId: draft.photoId, inputMethod: "photo" });
    // Pas de correction : la proposition a été acceptée telle quelle.
    expect(await db().select().from(foodCorrections)).toHaveLength(0);
  });

  it("refuse un fichier qui n'est pas une image, et la photo d'un autre membre", async () => {
    const userId = await setupUser();
    await expect(
      analyzePhoto(userId, { imageBase64: Buffer.alloc(200, 7).toString("base64"), mime: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "invalid_photo" });
    const { photoId } = await analyzePhoto(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });

    const [owner] = await db().select().from(user).where(eq(user.id, userId));
    const token = await createAccessLink({
      kind: "invite",
      householdId: owner!.householdId,
      createdBy: userId,
      role: "member",
      label: "Sam",
    });
    await acceptInvite({ token, name: "Sam", email: "sam@example.com", password: "un-autre-mot-de-passe" });
    const [sam] = await db().select().from(user).where(eq(user.email, "sam@example.com"));
    const rice = await firstFood(sam!.id, "riz basmati cuit");
    await expect(
      saveMeal(sam!.id, {
        date: todayIso(),
        slot: "lunch",
        method: "photo",
        photoId,
        items: [{ foodId: rice.id, estimate: null, quantity: 100, unit: "g", aiLabel: null, proposal: null }],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("purge les photos expirées et celles jamais ajoutées au journal", async () => {
    const userId = await setupUser();
    const rice = await firstFood(userId, "riz basmati cuit");
    const kept = await analyzePhoto(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    const unused = await analyzePhoto(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    const old = await analyzePhoto(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    for (const photoId of [kept.photoId, old.photoId]) {
      await saveMeal(userId, {
        date: todayIso(),
        slot: "lunch",
        method: "photo",
        photoId,
        items: [{ foodId: rice.id, estimate: null, quantity: 100, unit: "g", aiLabel: null, proposal: null }],
      });
    }
    await setPhotoSettings({ retentionDays: 30 });
    await db().execute(sql`update photos set created_at = now() - interval '2 days' where id = ${unused.photoId}`);
    await db().execute(sql`update photos set created_at = now() - interval '31 days' where id = ${old.photoId}`);

    expect(await purgePhotos()).toBe(2);
    expect((await db().select().from(photos)).map((photo) => photo.id)).toEqual([kept.photoId]);
    // Le repas reste dans le journal, sans sa photo.
    const entries = await db().select().from(mealEntries);
    expect(entries.map((entry) => entry.photoId).sort()).toEqual([kept.photoId, null].sort());
  });

  it("sans cron, la purge part au plus une fois toutes les 20 h", async () => {
    const userId = await setupUser();
    const unused = await analyzePhoto(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    await db().execute(sql`update photos set created_at = now() - interval '2 days' where id = ${unused.photoId}`);
    const now = new Date();

    expect(await lastPhotoPurge()).toBeNull();
    const [first, second] = await Promise.all([purgePhotosIfDue(now), purgePhotosIfDue(now)]);
    expect([first, second].sort()).toEqual([1, null].sort());
    expect(await lastPhotoPurge()).toEqual({ lastRunAt: now.toISOString(), purged: 1 });
    expect(await purgePhotosIfDue(new Date(now.getTime() + 19 * 3_600_000))).toBeNull();
    expect(await purgePhotosIfDue(new Date(now.getTime() + 21 * 3_600_000))).toBe(0);

    // La purge du cron (ou du bouton de l'admin) note aussi son passage.
    const later = new Date(now.getTime() + 22 * 3_600_000);
    expect(await runPhotoPurge(later)).toBe(0);
    expect(await lastPhotoPurge()).toEqual({ lastRunAt: later.toISOString(), purged: 0 });
  });

  it("l'export contient contenants, expressions et corrections", async () => {
    const userId = await setupUser();
    const bread = await firstFood(userId, "pain de mie courant");
    await createContainer(userId, { name: "Mug bleu", kind: "mug", volumeMl: 300, diameterCm: null });
    await saveExpression(userId, { phrase: "ma tartine", foodId: bread.id, quantity: 30, unit: "g" });
    const data = await collectUserData(userId);
    expect(data.containers).toEqual([{ name: "Mug bleu", kind: "mug", volumeMl: 300, diameterCm: null }]);
    expect(data.expressions).toEqual([{ phrase: "ma tartine", foodId: bread.id, quantity: 30, unit: "g" }]);
    expect(data.corrections).toEqual([]);
  });
});
