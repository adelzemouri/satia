import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { coachMessages, llmCalls, trainingPrograms, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { sendCoachMessage } from "@/server/coach";
import { collectUserData } from "@/server/data-export";
import { daySummary } from "@/server/journal";
import { saveOnboarding } from "@/server/profile";
import { setAiSettings } from "@/server/settings";
import {
  addCustomExercise,
  deleteSession,
  ensureProgram,
  getTrainingProfile,
  listCustomExercises,
  logSession,
  personalizeProgram,
  saveTrainingProfile,
  sessionFor,
  setExerciseExcluded,
  trainingHistory,
} from "@/server/training";
import { weekdayOf } from "@/server/training-day";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 80,
  goal: "maintain",
  targetWeightKg: null,
  activityLevel: 2,
  pace: "gentle",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily",
  coachStyle: "zen",
  disclaimerAccepted: true,
};

const today = todayIso();
const weekStart = isoWeekStart(today);
const todayIndex = weekdayOf(today);

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

async function withProfile(userId: string, days = [todayIndex, (todayIndex + 2) % 7]) {
  await saveTrainingProfile(userId, {
    level: "intermediate",
    goal: "strength",
    place: "home_equipped",
    equipment: ["dumbbells", "bands"],
    days,
    minutes: 30,
    avoidZones: ["knees"],
  });
}

describe("espace Training", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubEnv("LLM_PROVIDER", "mock");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("construit le programme de la semaine selon le profil, une fois", async () => {
    const userId = await setupUser();
    await expect(ensureProgram(userId)).rejects.toMatchObject({ code: "training_profile_missing" });
    await withProfile(userId);
    const program = await ensureProgram(userId);
    expect(program.sessions.map((session) => session.day).sort()).toEqual(
      [todayIndex, (todayIndex + 2) % 7].sort((a, b) => a - b),
    );
    for (const session of program.sessions) {
      expect(session.warmup.length).toBeGreaterThan(0);
      expect(session.cooldown.length).toBeGreaterThan(0);
      for (const item of [...session.warmup, ...session.main, ...session.cooldown]) {
        const exercise = exerciseById(item.exerciseId)!;
        expect(exercise.stress).not.toContain("knees");
        expect(exercise.equipment.every((needed) => ["dumbbells", "bands"].includes(needed))).toBe(true);
      }
    }
    expect(await ensureProgram(userId)).toEqual(program);

    // Changer le profil recalcule le programme.
    await withProfile(userId, [todayIndex]);
    expect((await ensureProgram(userId)).sessions).toHaveLength(1);
  });

  it("le coach personnalise le programme en un seul appel, sans changer les exercices", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    const before = await ensureProgram(userId);
    expect(await personalizeProgram(userId)).toBe(true);
    const after = await ensureProgram(userId);
    expect(after.personalized).toBe(true);
    expect(after.intro).toContain("régularité");
    expect(after.sessions[0]!.title).toBe("Séance 1 en douceur");
    // Le fournisseur simulé inverse l'ordre des exercices principaux.
    expect(after.sessions[0]!.main.map((item) => item.exerciseId)).toEqual(
      before.sessions[0]!.main.map((item) => item.exerciseId).reverse(),
    );
    expect(await personalizeProgram(userId)).toBe(false);
    const calls = await db().select().from(llmCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ feature: "training_plan", status: "ok" });
  });

  it("sans IA, le programme des règles reste disponible", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    await setAiSettings({ enabled: false, monthlyBudgetUsd: null });
    expect(await personalizeProgram(userId)).toBe(false);
    const [row] = await db().select().from(trainingPrograms).where(eq(trainingPrograms.userId, userId));
    expect(row!.personalized).toBe(false);
    expect(row!.sessions.length).toBeGreaterThan(0);
  });

  it("propose une séance de remplacement, express ou à la demande", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    const planned = await sessionFor(userId, { kind: "program", day: todayIndex });
    const replaced = await sessionFor(userId, { kind: "program", day: todayIndex, variant: 1 });
    expect(replaced!.focus).toBe(planned!.focus);
    expect(replaced!.minutes).toBe(planned!.minutes);
    expect(replaced!.main.map((item) => item.exerciseId)).not.toEqual(planned!.main.map((item) => item.exerciseId));
    expect((await sessionFor(userId, { kind: "express" }))!.minutes).toBe(10);
    const bare = await sessionFor(userId, { kind: "on_demand", minutes: 20, noEquipment: true });
    for (const item of bare!.main) expect(exerciseById(item.exerciseId)!.equipment).toEqual([]);
    expect(await sessionFor(userId, { kind: "program", day: (todayIndex + 1) % 7 })).toBeNull();
  });

  it("une séance faite ajoute ses calories au budget du jour et relève les protéines", async () => {
    const userId = await setupUser();
    const before = await daySummary(userId, today);
    await withProfile(userId);
    await ensureProgram(userId);
    const planned = await daySummary(userId, today);
    // Jour d'entraînement prévu : protéines relevées, calories inchangées tant que rien n'est fait.
    expect(planned.goal!.kcal).toBe(before.goal!.kcal);
    expect(planned.goal!.proteinG).toBe(Math.round(before.goal!.proteinG * 1.1));

    const id = await logSession(userId, {
      kind: "program",
      focus: "upper",
      title: "Haut du corps",
      durationMin: 30,
      feeling: "easy",
      items: [
        { exerciseId: "curl-halteres", sets: [{ reps: 12, weightKg: 8, seconds: null }] },
        { exerciseId: "planche", sets: [{ reps: null, weightKg: null, seconds: 40 }] },
        { exerciseId: "inconnu", sets: [{ reps: 5, weightKg: null, seconds: null }] },
      ],
    });
    const [session] = await trainingHistory(userId);
    expect(session).toMatchObject({ id, kcal: Math.round((3.5 * 80 * 30) / 60) });
    expect(session!.items.map((item) => item.exerciseId)).toEqual(["curl-halteres", "planche"]);

    const after = await daySummary(userId, today);
    expect(after.training).toEqual({ burnedKcal: session!.kcal, sessions: 1 });
    expect(after.goal!.kcal).toBe(before.goal!.kcal + session!.kcal);
    expect((await getTrainingProfile(userId))!.progression).toBe(1.1);

    await deleteSession(userId, id);
    expect((await daySummary(userId, today)).goal!.kcal).toBe(before.goal!.kcal);
  });

  it("un exercice signalé douloureux n'est plus proposé", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    const first = (await ensureProgram(userId)).sessions[0]!.main[0]!.exerciseId;
    await setExerciseExcluded(userId, first, true);
    expect((await getTrainingProfile(userId))!.excluded).toEqual([first]);
    const program = await ensureProgram(userId);
    for (const session of program.sessions) {
      expect(session.main.map((item) => item.exerciseId)).not.toContain(first);
    }
    await setExerciseExcluded(userId, first, false);
    expect((await getTrainingProfile(userId))!.excluded).toEqual([]);
    await expect(setExerciseExcluded(userId, "inconnu", true)).rejects.toMatchObject({ code: "not_found" });
  });

  it("le coach du chat présente une séance construite par les règles", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    await sendCoachMessage(userId, "J'ai 20 minutes, pas de matériel, une séance ?");
    const messages = await db().select().from(coachMessages).where(eq(coachMessages.userId, userId));
    expect(messages).toHaveLength(2);
    const [call] = await db().select().from(llmCalls);
    expect(call).toMatchObject({ feature: "coach", status: "ok" });
  });

  it("exercices personnels et export complet", async () => {
    const userId = await setupUser();
    await withProfile(userId);
    await ensureProgram(userId);
    await addCustomExercise(userId, { name: "Gainage sur ballon", muscle: "core", mode: "time", notes: "" });
    expect((await listCustomExercises(userId)).map((item) => item.name)).toEqual(["Gainage sur ballon"]);
    await logSession(userId, {
      kind: "express",
      focus: "full_body",
      title: "Séance express",
      durationMin: 10,
      feeling: null,
      items: [{ exerciseId: "squat", sets: [{ reps: 10, weightKg: null, seconds: null }] }],
    });
    const data = await collectUserData(userId);
    expect(data.trainingProfile?.goal).toBe("strength");
    expect(data.trainingSessions).toHaveLength(1);
    expect(data.customExercises).toHaveLength(1);
    expect(data.trainingPrograms.map((program) => program.weekStart)).toEqual([weekStart]);
  });
});
