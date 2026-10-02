import { EXERCISES, exerciseById } from "./exercises";
import type {
  Equipment,
  Exercise,
  Feeling,
  Focus,
  LoggedExercise,
  Muscle,
  PlannedSession,
  Prescription,
  TrainingGoal,
  TrainingLevel,
  TrainingProfile,
} from "./types";

/**
 * Moteur de règles du programme : il choisit les exercices adaptés au profil (niveau,
 * matériel, zones à ménager) et construit des séances complètes, toujours encadrées par
 * un échauffement et un retour au calme. Déterministe : la même graine donne la même séance.
 */

const LEVEL_RANK: Record<TrainingLevel, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Petit générateur pseudo-aléatoire reproductible (mulberry32). */
export function seededRandom(seed: string): () => number {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Matériel réellement utilisable selon le lieu. */
export function availableEquipment(profile: Pick<TrainingProfile, "place" | "equipment">): Set<Equipment> {
  if (profile.place === "gym") {
    return new Set([
      "none",
      "dumbbells",
      "bands",
      "pullup_bar",
      "kettlebell",
      "jump_rope",
      "bench",
      "barbell",
      "machines",
    ]);
  }
  if (profile.place === "home_none") return new Set(["none"]);
  return new Set(["none", ...profile.equipment.filter((item) => item !== "barbell" && item !== "machines")]);
}

/** Exercices permis : matériel disponible, niveau atteint, aucune zone à ménager sollicitée, rien de signalé. */
export function allowedExercises(
  profile: Pick<TrainingProfile, "level" | "place" | "equipment" | "avoidZones" | "excluded">,
  library: readonly Exercise[] = EXERCISES,
): Exercise[] {
  const equipment = availableEquipment(profile);
  const rank = LEVEL_RANK[profile.level];
  const excluded = new Set(profile.excluded);
  return library.filter(
    (exercise) =>
      exercise.level <= rank &&
      !excluded.has(exercise.id) &&
      exercise.equipment.every((item) => equipment.has(item)) &&
      !exercise.stress.some((zone) => profile.avoidZones.includes(zone)),
  );
}

/** Groupes visés par type de séance, dans l'ordre d'alternance. */
const FOCUS_MUSCLES: Record<Focus, Muscle[]> = {
  full_body: ["legs", "chest", "back", "glutes", "core", "shoulders", "full_body", "arms"],
  upper: ["chest", "back", "shoulders", "arms", "core"],
  lower: ["legs", "glutes", "core"],
  cardio: ["cardio", "full_body", "legs", "core"],
  mobility: ["mobility"],
};

/** Répartition des séances sur les jours disponibles, avec alternance des groupes musculaires. */
export function weeklySplit(goal: TrainingGoal, count: number): Focus[] {
  const cycle: Record<TrainingGoal, Focus[]> = {
    weight_loss: count <= 3 ? ["full_body", "cardio", "full_body"] : ["upper", "lower", "cardio", "full_body"],
    strength:
      count <= 2 ? ["full_body", "full_body"] : count === 3 ? ["upper", "lower", "full_body"] : ["upper", "lower"],
    muscle:
      count <= 2 ? ["full_body", "full_body"] : count === 3 ? ["upper", "lower", "full_body"] : ["upper", "lower"],
    endurance: ["cardio", "full_body"],
    mobility: count >= 3 ? ["mobility", "mobility", "full_body"] : ["mobility"],
  };
  return Array.from({ length: count }, (_, index) => cycle[goal][index % cycle[goal].length]!);
}

type Dose = { reps: number; seconds: number; restSeconds: number };

/** Dose de base par objectif : répétitions, durée de travail et repos entre séries. */
const DOSES: Record<TrainingGoal, Dose> = {
  muscle: { reps: 10, seconds: 40, restSeconds: 75 },
  strength: { reps: 12, seconds: 40, restSeconds: 60 },
  weight_loss: { reps: 14, seconds: 40, restSeconds: 30 },
  endurance: { reps: 18, seconds: 45, restSeconds: 30 },
  mobility: { reps: 10, seconds: 45, restSeconds: 15 },
};
const SETS: Record<TrainingLevel, number> = { beginner: 2, intermediate: 3, advanced: 4 };
/** Secondes par répétition, pour estimer la durée d'une série. */
const SECONDS_PER_REP = 3;
const TRANSITION_SECONDS = 30;

export function clampProgression(value: number): number {
  return Math.min(1.5, Math.max(0.7, Math.round(value * 100) / 100));
}

/** Ressenti après la séance → réglage du programme de la semaine suivante (progression graduelle). */
export function nextProgression(current: number, feeling: Feeling): number {
  const step = feeling === "easy" ? 0.1 : feeling === "good" ? 0.03 : -0.1;
  return clampProgression(current + step);
}

function prescribe(exercise: Exercise, sets: number, dose: Dose, factor: number): Prescription {
  const progressedSets = factor >= 1.3 ? Math.min(5, sets + 1) : sets;
  return {
    exerciseId: exercise.id,
    sets: progressedSets,
    reps: exercise.mode === "reps" ? Math.max(4, Math.round(dose.reps * factor)) : null,
    seconds: exercise.mode === "time" ? Math.max(15, Math.round((dose.seconds * factor) / 5) * 5) : null,
    restSeconds: dose.restSeconds,
  };
}

/** Durée estimée d'un exercice prescrit, en secondes. */
export function prescriptionSeconds(item: Prescription): number {
  const work = item.seconds ?? (item.reps ?? 0) * SECONDS_PER_REP;
  return item.sets * work + Math.max(0, item.sets - 1) * item.restSeconds + TRANSITION_SECONDS;
}

export function sessionSeconds(session: Pick<PlannedSession, "warmup" | "main" | "cooldown">): number {
  return [...session.warmup, ...session.main, ...session.cooldown].reduce(
    (sum, item) => sum + prescriptionSeconds(item),
    0,
  );
}

function pickPhase(pool: Exercise[], phase: Exercise["phase"], count: number, random: () => number): Exercise[] {
  const candidates = shuffle(
    pool.filter((exercise) => exercise.phase === phase),
    random,
  );
  return candidates.slice(0, count);
}

/** Choisit les exercices principaux en alternant les groupes musculaires de la séance. */
function pickMain(pool: Exercise[], focus: Focus, count: number, random: () => number, avoid: Set<string>): Exercise[] {
  const muscles = FOCUS_MUSCLES[focus];
  const candidates =
    focus === "mobility"
      ? pool.filter((exercise) => exercise.phase !== "main" && exercise.muscle === "mobility")
      : pool.filter((exercise) => exercise.phase === "main");
  const byMuscle = new Map(
    muscles.map((muscle) => {
      const own = candidates.filter((exercise) => exercise.muscle === muscle);
      // Les exercices déjà vus (séance remplacée) passent en dernier.
      const shuffled = shuffle(own, random);
      return [muscle, [...shuffled.filter((e) => !avoid.has(e.id)), ...shuffled.filter((e) => avoid.has(e.id))]];
    }),
  );
  const chosen: Exercise[] = [];
  for (let round = 0; chosen.length < count && round < 10; round++) {
    for (const muscle of muscles) {
      if (chosen.length >= count) break;
      const next = byMuscle.get(muscle)?.find((exercise) => !chosen.includes(exercise));
      if (next) chosen.push(next);
    }
  }
  return chosen;
}

export type BuildOptions = {
  profile: TrainingProfile;
  focus: Focus;
  minutes: number;
  /** Graine : utilisateur, semaine, jour et variante (« Remplacer »). */
  seed: string;
  day: number | null;
  progression?: number;
  /** Exercices à éviter si possible (ceux de la séance remplacée). */
  avoid?: readonly string[];
  library?: readonly Exercise[];
};

/** Construit une séance complète qui tient dans la durée demandée. */
export function buildSession(options: BuildOptions): PlannedSession {
  const { profile, focus, minutes } = options;
  const random = seededRandom(options.seed);
  const pool = allowedExercises(profile, options.library);
  const factor = clampProgression(options.progression ?? 1);
  const short = minutes <= 15;
  const gentleSeconds = short ? 45 : 60;

  const warmup = pickPhase(pool, "warmup", short ? 2 : 3, random).map((exercise) => ({
    exerciseId: exercise.id,
    sets: 1,
    reps: null,
    seconds: gentleSeconds,
    restSeconds: 0,
  }));
  const cooldown = pickPhase(pool, "cooldown", short ? 2 : 3, random).map((exercise) => ({
    exerciseId: exercise.id,
    sets: 1,
    reps: null,
    seconds: gentleSeconds,
    restSeconds: 0,
  }));

  const dose = DOSES[profile.goal];
  const sets = short ? 2 : SETS[profile.level];
  const budget = minutes * 60 - sessionSeconds({ warmup, main: [], cooldown });
  const taken = new Set([...warmup, ...cooldown].map((item) => item.exerciseId));
  const ordered = pickMain(
    pool.filter((exercise) => !taken.has(exercise.id)),
    focus,
    10,
    random,
    new Set(options.avoid ?? []),
  );
  const main: Prescription[] = [];
  let used = 0;
  for (const exercise of ordered) {
    const item = prescribe(exercise, sets, dose, factor);
    const cost = prescriptionSeconds(item);
    if (main.length >= 2 && used + cost > budget) break;
    main.push(item);
    used += cost;
  }
  return { day: options.day, focus, minutes, warmup, main, cooldown };
}

/** Séance express de 10 minutes : circuit court, échauffement et retour au calme compris. */
export function expressSession(profile: TrainingProfile, seed: string, progression = 1): PlannedSession {
  // On construit plus large puis on garde un circuit de trois exercices.
  const session = buildSession({ profile, focus: "full_body", minutes: 30, seed, day: null, progression });
  const factor = clampProgression(progression);
  return {
    ...session,
    minutes: 10,
    warmup: session.warmup.slice(0, 2).map((item) => ({ ...item, seconds: 45 })),
    cooldown: session.cooldown.slice(0, 2).map((item) => ({ ...item, seconds: 45 })),
    main: session.main.slice(0, 3).map((item) => ({
      ...item,
      sets: 2,
      reps: item.reps === null ? null : Math.max(4, Math.round(10 * factor)),
      seconds: item.seconds === null ? null : 30,
      restSeconds: 20,
    })),
  };
}

/** Programme de la semaine : une séance par jour disponible, les autres jours sont du repos. */
export function weeklyProgram(
  profile: TrainingProfile,
  seed: string,
  progression = 1,
  library?: readonly Exercise[],
): PlannedSession[] {
  const days = [...new Set(profile.days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  const focuses = weeklySplit(profile.goal, days.length);
  return days.map((day, index) =>
    buildSession({
      profile,
      focus: focuses[index]!,
      minutes: profile.minutes,
      seed: `${seed}:${day}`,
      day,
      progression,
      library,
    }),
  );
}

/** MET moyen d'une séance, pondéré par la durée prévue de chaque exercice. */
export function sessionMet(session: Pick<PlannedSession, "warmup" | "main" | "cooldown">): number {
  let weighted = 0;
  let total = 0;
  for (const item of [...session.warmup, ...session.main, ...session.cooldown]) {
    const seconds = prescriptionSeconds(item);
    weighted += (exerciseById(item.exerciseId)?.met ?? 3.5) * seconds;
    total += seconds;
  }
  return total > 0 ? weighted / total : 3.5;
}

/** Calories dépensées : MET × poids (kg) × durée (h). */
export function burnedKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * weightKg * minutes) / 60);
}

/**
 * Objectif du jour d'entraînement : les calories dépensées s'ajoutent au budget, les protéines
 * sont relevées de 10 %, glucides et lipides se partagent le reste dans les mêmes proportions.
 */
export function trainingDayGoal<T extends { kcal: number; proteinG: number; carbsG: number; fatG: number }>(
  goal: T,
  burned: number,
  trainingDay: boolean,
): T {
  if (!trainingDay && burned <= 0) return goal;
  const proteinG = trainingDay ? Math.round(goal.proteinG * 1.1) : goal.proteinG;
  const kcal = goal.kcal + Math.max(0, burned);
  const restBefore = goal.carbsG * 4 + goal.fatG * 9;
  const ratio = restBefore > 0 ? Math.max(0, kcal - proteinG * 4) / restBefore : 1;
  return { ...goal, kcal, proteinG, carbsG: Math.round(goal.carbsG * ratio), fatG: Math.round(goal.fatG * ratio) };
}

/** Semaines ISO consécutives avec au moins une séance, en comptant celle en cours si elle en a une. */
export function trainingStreak(weeksWithSession: ReadonlySet<string>, currentWeek: string): number {
  const previous = (week: string) => {
    const date = new Date(`${week}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0, 10);
  };
  let week = weeksWithSession.has(currentWeek) ? currentWeek : previous(currentWeek);
  let count = 0;
  while (weeksWithSession.has(week)) {
    count += 1;
    week = previous(week);
  }
  return count;
}

export type PersonalRecord = {
  exerciseId: string;
  maxWeightKg: number | null;
  maxReps: number | null;
  maxSeconds: number | null;
};

/** Records personnels par exercice, à partir des séries saisies. */
export function personalRecords(sessions: readonly { items: LoggedExercise[] }[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  const best = (a: number | null, b: number | null) => (b === null ? a : a === null ? b : Math.max(a, b));
  for (const session of sessions) {
    for (const item of session.items) {
      const record = records.get(item.exerciseId) ?? {
        exerciseId: item.exerciseId,
        maxWeightKg: null,
        maxReps: null,
        maxSeconds: null,
      };
      for (const set of item.sets) {
        record.maxWeightKg = best(record.maxWeightKg, set.weightKg && set.weightKg > 0 ? set.weightKg : null);
        record.maxReps = best(record.maxReps, set.reps && set.reps > 0 ? set.reps : null);
        record.maxSeconds = best(record.maxSeconds, set.seconds && set.seconds > 0 ? set.seconds : null);
      }
      records.set(item.exerciseId, record);
    }
  }
  return [...records.values()];
}

/** Nombre de séries réalisées par groupe musculaire. */
export function volumeByMuscle(sessions: readonly { items: LoggedExercise[] }[]): Partial<Record<Muscle, number>> {
  const volume: Partial<Record<Muscle, number>> = {};
  for (const session of sessions) {
    for (const item of session.items) {
      const exercise = exerciseById(item.exerciseId);
      if (!exercise || exercise.phase !== "main") continue;
      volume[exercise.muscle] = (volume[exercise.muscle] ?? 0) + item.sets.length;
    }
  }
  return volume;
}
