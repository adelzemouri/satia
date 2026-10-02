import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { customExercises, trainingPrograms, trainingProfiles, trainingSessions } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { burnedKcal, buildSession, expressSession, nextProgression, weeklyProgram } from "@/domain/training/program";
import {
  EQUIPMENT,
  FEELINGS,
  FOCUSES,
  type LoggedExercise,
  MUSCLES,
  PLACES,
  type PlannedSession,
  SESSION_MINUTES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  type TrainingProfile,
  ZONES,
} from "@/domain/training/types";
import { AiUnavailableError, personalizeTrainingPlan } from "@/llm";

import { DomainError } from "./errors";
import { latestWeight } from "./journal";
import { getProfile } from "./profile";
import { weekdayOf } from "./training-day";

// --- Profil sportif --------------------------------------------------------------------

export const trainingProfileSchema = z.object({
  level: z.enum(TRAINING_LEVELS),
  goal: z.enum(TRAINING_GOALS),
  place: z.enum(PLACES),
  equipment: z
    .array(z.enum(EQUIPMENT).exclude(["none"]))
    .max(EQUIPMENT.length)
    .default([]),
  days: z.array(z.number().int().min(0).max(6)).min(1, "required").max(7),
  minutes: z.union(SESSION_MINUTES.map((value) => z.literal(value))),
  avoidZones: z.array(z.enum(ZONES)).max(ZONES.length).default([]),
});
export type TrainingProfileInput = z.input<typeof trainingProfileSchema>;

export type StoredTrainingProfile = TrainingProfile & { progression: number };

export async function getTrainingProfile(userId: string): Promise<StoredTrainingProfile | null> {
  const [row] = await db().select().from(trainingProfiles).where(eq(trainingProfiles.userId, userId));
  if (!row) return null;
  return {
    level: row.level,
    goal: row.goal,
    place: row.place,
    equipment: row.equipment,
    days: row.days,
    minutes: row.minutes as TrainingProfile["minutes"],
    avoidZones: row.avoidZones,
    excluded: row.excluded,
    progression: row.progression,
  };
}

/** Enregistre le profil ; le programme de la semaine en cours est recalculé à la prochaine visite. */
export async function saveTrainingProfile(userId: string, input: TrainingProfileInput): Promise<void> {
  const data = trainingProfileSchema.parse(input);
  const values = {
    ...data,
    days: [...new Set(data.days)].sort((a, b) => a - b),
    equipment: [...new Set(data.equipment)],
    avoidZones: [...new Set(data.avoidZones)],
  };
  await db().transaction(async (tx) => {
    await tx
      .insert(trainingProfiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: trainingProfiles.userId, set: { ...values, updatedAt: new Date() } });
    await tx
      .delete(trainingPrograms)
      .where(and(eq(trainingPrograms.userId, userId), gte(trainingPrograms.weekStart, isoWeekStart(todayIso()))));
  });
}

async function requireTrainingProfile(userId: string): Promise<StoredTrainingProfile> {
  const profile = await getTrainingProfile(userId);
  if (!profile) throw new DomainError("training_profile_missing");
  return profile;
}

/** Exercice signalé douloureux : il n'est plus proposé (programme recalculé). */
export async function setExerciseExcluded(userId: string, exerciseId: string, excluded: boolean): Promise<void> {
  if (!exerciseById(z.string().parse(exerciseId))) throw new DomainError("not_found");
  const profile = await requireTrainingProfile(userId);
  const list = excluded
    ? [...new Set([...profile.excluded, exerciseId])]
    : profile.excluded.filter((id) => id !== exerciseId);
  await db().transaction(async (tx) => {
    await tx
      .update(trainingProfiles)
      .set({ excluded: list, updatedAt: new Date() })
      .where(eq(trainingProfiles.userId, userId));
    // Le programme à venir ne doit plus contenir l'exercice : il sera reconstruit.
    await tx
      .delete(trainingPrograms)
      .where(and(eq(trainingPrograms.userId, userId), gte(trainingPrograms.weekStart, isoWeekStart(todayIso()))));
  });
}

// --- Programme de la semaine -----------------------------------------------------------------

export type WeekProgram = {
  weekStart: string;
  sessions: PlannedSession[];
  intro: string | null;
  personalized: boolean;
};

/** Programme de la semaine : construit par les règles à la première visite, puis conservé. */
export async function ensureProgram(
  userId: string,
  weekStart: string = isoWeekStart(todayIso()),
): Promise<WeekProgram> {
  const [existing] = await db()
    .select()
    .from(trainingPrograms)
    .where(and(eq(trainingPrograms.userId, userId), eq(trainingPrograms.weekStart, weekStart)));
  if (existing) return existing;
  const profile = await requireTrainingProfile(userId);
  const sessions = weeklyProgram(profile, `${userId}:${weekStart}`, profile.progression);
  const [row] = await db()
    .insert(trainingPrograms)
    .values({ userId, weekStart, sessions })
    .onConflictDoNothing()
    .returning();
  return row ?? (await ensureProgram(userId, weekStart));
}

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const FOCUS_NAMES: Record<PlannedSession["focus"], string> = {
  full_body: "corps entier",
  upper: "haut du corps",
  lower: "bas du corps",
  cardio: "cardio",
  mobility: "mobilité",
};
const LEVEL_NAMES = { beginner: "débutant", intermediate: "intermédiaire", advanced: "confirmé" } as const;
const GOAL_NAMES = {
  weight_loss: "perte de poids",
  strength: "renforcement",
  muscle: "prise de muscle",
  endurance: "endurance",
  mobility: "mobilité",
} as const;

/** Une permutation valide des numéros 1..n, sinon rien. */
function validOrder(order: readonly number[], length: number): number[] | null {
  if (order.length !== length) return null;
  const sorted = [...order].sort((a, b) => a - b);
  return sorted.every((value, index) => value === index + 1) ? [...order] : null;
}

/**
 * Passage du coach sur le programme : un seul appel au modèle texte par semaine, qui donne
 * l'ordre des exercices, un titre et un conseil par séance. Sans IA, le programme reste tel quel.
 */
export async function personalizeProgram(
  userId: string,
  weekStart: string = isoWeekStart(todayIso()),
): Promise<boolean> {
  const program = await ensureProgram(userId, weekStart);
  if (program.personalized || program.sessions.length === 0) return false;
  const [profile, nutrition] = await Promise.all([requireTrainingProfile(userId), getProfile(userId)]);
  const prompt = [
    `Niveau : ${LEVEL_NAMES[profile.level]}. Objectif : ${GOAL_NAMES[profile.goal]}.`,
    profile.avoidZones.length > 0 ? `Zones à ménager : ${profile.avoidZones.join(", ")}.` : null,
    ...program.sessions.map(
      (session, index) =>
        `S${index + 1} | ${session.day === null ? "" : DAY_NAMES[session.day]} | ${FOCUS_NAMES[session.focus]} | ${session.minutes} min | ${session.main
          .map((item, i) => `${i + 1}. ${exerciseById(item.exerciseId)?.name ?? item.exerciseId}`)
          .join(" ; ")}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  let text;
  try {
    text = await personalizeTrainingPlan(userId, nutrition?.coachStyle ?? "teacher", prompt);
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) throw error;
    // Panne du fournisseur : on n'insiste pas cette semaine. IA coupée ou plafond : on réessaiera.
    if (error.reason === "provider_error") {
      await db()
        .update(trainingPrograms)
        .set({ personalized: true })
        .where(and(eq(trainingPrograms.userId, userId), eq(trainingPrograms.weekStart, weekStart)));
    }
    return false;
  }
  const sessions = program.sessions.map((session, index) => {
    const coach = text.sessions.find((item) => item.index === index + 1);
    if (!coach) return session;
    const order = validOrder(coach.order, session.main.length);
    return {
      ...session,
      title: coach.title,
      tip: coach.tip || undefined,
      main: order ? order.map((position) => session.main[position - 1]!) : session.main,
    };
  });
  await db()
    .update(trainingPrograms)
    .set({ sessions, intro: text.intro || null, personalized: true })
    .where(and(eq(trainingPrograms.userId, userId), eq(trainingPrograms.weekStart, weekStart)));
  return true;
}

// --- Séances ---------------------------------------------------------------------------------

export const sessionSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("program"),
    day: z.number().int().min(0).max(6),
    variant: z.number().int().min(0).max(20).default(0),
  }),
  z.object({ kind: z.literal("express") }),
  z.object({
    kind: z.literal("on_demand"),
    minutes: z.number().int().min(10).max(60),
    noEquipment: z.boolean().default(false),
    focus: z.enum(FOCUSES).default("full_body"),
  }),
]);
export type SessionSpec = z.input<typeof sessionSpecSchema>;

/** Séance à dérouler : du programme (éventuellement remplacée), express ou à la demande. */
export async function sessionFor(
  userId: string,
  input: SessionSpec,
  date: string = todayIso(),
): Promise<PlannedSession | null> {
  const spec = sessionSpecSchema.parse(input);
  const profile = await requireTrainingProfile(userId);
  const weekStart = isoWeekStart(date);
  if (spec.kind === "express") {
    return expressSession(profile, `${userId}:${date}:express`, profile.progression);
  }
  if (spec.kind === "on_demand") {
    return buildSession({
      profile: spec.noEquipment ? { ...profile, place: "home_none", equipment: [] } : profile,
      focus: spec.focus,
      minutes: spec.minutes,
      seed: `${userId}:${date}:${spec.minutes}:${spec.focus}`,
      day: null,
      progression: profile.progression,
    });
  }
  const program = await ensureProgram(userId, weekStart);
  const planned = program.sessions.find((session) => session.day === spec.day);
  if (!planned) return null;
  if (spec.variant === 0) return planned;
  // « Remplacer » : même type de séance et même durée, d'autres exercices si possible.
  return buildSession({
    profile,
    focus: planned.focus,
    minutes: planned.minutes,
    seed: `${userId}:${weekStart}:${spec.day}:v${spec.variant}`,
    day: spec.day,
    progression: profile.progression,
    avoid: planned.main.map((item) => item.exerciseId),
  });
}

const loggedSetSchema = z.object({
  reps: z.number().int().min(0).max(500).nullable(),
  weightKg: z.number().min(0).max(500).nullable(),
  seconds: z.number().int().min(0).max(3600).nullable(),
});

export const logSessionSchema = z.object({
  kind: z.enum(["program", "replacement", "express", "on_demand"]),
  focus: z.enum(FOCUSES),
  title: z.string().trim().min(1).max(80),
  durationMin: z.number().int().min(1).max(240),
  feeling: z.enum(FEELINGS).nullable(),
  items: z.array(z.object({ exerciseId: z.string().min(1).max(60), sets: z.array(loggedSetSchema).max(10) })).max(30),
});
export type LogSessionInput = z.input<typeof logSessionSchema>;

/** MET moyen des exercices réalisés, pondéré par le nombre de séries (3,5 par défaut). */
function loggedMet(items: readonly LoggedExercise[]): number {
  let weighted = 0;
  let count = 0;
  for (const item of items) {
    const sets = Math.max(1, item.sets.length);
    weighted += (exerciseById(item.exerciseId)?.met ?? 3.5) * sets;
    count += sets;
  }
  return count > 0 ? weighted / count : 3.5;
}

/**
 * Enregistre une séance terminée : les calories (MET × poids × durée) sont calculées ici et
 * s'ajoutent au budget du jour ; le ressenti règle la progression de la semaine suivante.
 */
export async function logSession(userId: string, input: LogSessionInput, date: string = todayIso()): Promise<string> {
  const data = logSessionSchema.parse(input);
  const [profile, nutrition, weight] = await Promise.all([
    requireTrainingProfile(userId),
    getProfile(userId),
    latestWeight(userId, date),
  ]);
  const items = data.items.filter((item) => exerciseById(item.exerciseId) && item.sets.length > 0);
  const weightKg = weight ?? nutrition?.startWeightKg ?? 70;
  const kcal = burnedKcal(loggedMet(items), weightKg, data.durationMin);
  return db().transaction(async (tx) => {
    const [row] = await tx
      .insert(trainingSessions)
      .values({ userId, date, ...data, items, kcal })
      .returning({ id: trainingSessions.id });
    if (data.feeling) {
      await tx
        .update(trainingProfiles)
        .set({ progression: nextProgression(profile.progression, data.feeling), updatedAt: new Date() })
        .where(eq(trainingProfiles.userId, userId));
    }
    return row!.id;
  });
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  await db()
    .delete(trainingSessions)
    .where(and(eq(trainingSessions.id, z.uuid().parse(id)), eq(trainingSessions.userId, userId)));
}

export type TrainingSessionRow = typeof trainingSessions.$inferSelect;

/** Séances des dernières semaines, de la plus récente à la plus ancienne. */
export async function trainingHistory(userId: string, days = 84): Promise<TrainingSessionRow[]> {
  return db()
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.date, addDays(todayIso(), -days))))
    .orderBy(desc(trainingSessions.date), desc(trainingSessions.createdAt));
}

/** Semaines (lundi) où au moins une séance a été faite : pour le streak d'entraînement. */
export async function trainingWeeks(userId: string): Promise<Set<string>> {
  const rows = await db()
    .selectDistinct({ date: trainingSessions.date })
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId));
  return new Set(rows.map((row) => isoWeekStart(row.date)));
}

/** Séance du jour du programme, avec sa position (pour « Démarrer » et « Remplacer »). */
export function todayFromProgram(program: WeekProgram, date: string = todayIso()): PlannedSession | null {
  return program.sessions.find((session) => session.day === weekdayOf(date)) ?? null;
}

// --- Exercices personnels --------------------------------------------------------------------

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, "required").max(80),
  muscle: z.enum(MUSCLES),
  mode: z.enum(["reps", "time"]),
  notes: z.string().trim().max(500).default(""),
});

export async function addCustomExercise(userId: string, input: z.input<typeof customExerciseSchema>): Promise<void> {
  const data = customExerciseSchema.parse(input);
  const existing = await db()
    .select({ id: customExercises.id })
    .from(customExercises)
    .where(eq(customExercises.userId, userId));
  if (existing.length >= 100) throw new DomainError("too_many");
  await db()
    .insert(customExercises)
    .values({ userId, ...data, notes: data.notes || null });
}

export async function listCustomExercises(userId: string) {
  return db().select().from(customExercises).where(eq(customExercises.userId, userId)).orderBy(customExercises.name);
}

export async function deleteCustomExercise(userId: string, id: string): Promise<void> {
  await db()
    .delete(customExercises)
    .where(and(eq(customExercises.id, z.uuid().parse(id)), eq(customExercises.userId, userId)));
}

/** Pour l'export : profil sportif, programmes, séances et exercices personnels. */
export async function trainingExport(userId: string) {
  const [profile, programs, sessions, custom] = await Promise.all([
    db().select().from(trainingProfiles).where(eq(trainingProfiles.userId, userId)),
    db().select().from(trainingPrograms).where(eq(trainingPrograms.userId, userId)).orderBy(trainingPrograms.weekStart),
    db().select().from(trainingSessions).where(eq(trainingSessions.userId, userId)).orderBy(trainingSessions.date),
    db().select().from(customExercises).where(eq(customExercises.userId, userId)),
  ]);
  return { profile: profile[0] ?? null, programs, sessions, custom };
}

/**
 * Séance proposée par le coach dans le chat : construite par les règles (profil, zones à
 * ménager), décrite en une ligne de contexte que le coach reformule. Null sans profil sportif.
 */
export async function coachWorkoutLine(
  userId: string,
  request: { minutes: number; noEquipment: boolean },
  date: string = todayIso(),
): Promise<string | null> {
  const profile = await getTrainingProfile(userId);
  if (!profile) return null;
  const session = buildSession({
    profile: request.noEquipment ? { ...profile, place: "home_none", equipment: [] } : profile,
    focus: profile.goal === "mobility" ? "mobility" : profile.goal === "endurance" ? "cardio" : "full_body",
    minutes: request.minutes,
    seed: `${userId}:${date}:coach:${request.minutes}`,
    day: null,
    progression: profile.progression,
  });
  const describe = (items: PlannedSession["main"]) =>
    items
      .map((item) => {
        const exercise = exerciseById(item.exerciseId);
        const dose = item.reps !== null ? `${item.reps} rép.` : `${item.seconds} s`;
        return `${exercise?.name ?? item.exerciseId} (${item.sets > 1 ? `${item.sets} × ` : ""}${dose}, plus doux : ${exercise?.easier ?? "ralentir"})`;
      })
      .join(" ; ");
  return [
    `Séance demandée (${request.minutes} min, à présenter telle quelle, sans ajouter d'exercice) :`,
    `Échauffement : ${describe(session.warmup)}.`,
    `Exercices : ${describe(session.main)}.`,
    `Retour au calme : ${describe(session.cooldown)}.`,
    profile.avoidZones.length > 0 ? `Zones à ménager : ${profile.avoidZones.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
