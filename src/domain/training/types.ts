/** Espace Training : vocabulaire commun (calcul pur, sans dépendance au serveur). */

export const MUSCLES = [
  "legs",
  "glutes",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "full_body",
  "cardio",
  "mobility",
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** Matériel ; « none » signifie poids du corps (un tapis et une chaise suffisent). */
export const EQUIPMENT = [
  "none",
  "dumbbells",
  "bands",
  "pullup_bar",
  "kettlebell",
  "jump_rope",
  "bench",
  "barbell",
  "machines",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];
/** Matériel qu'on peut déclarer à la maison ou dehors (le reste suppose une salle). */
export const HOME_EQUIPMENT = ["dumbbells", "bands", "pullup_bar", "kettlebell", "jump_rope", "bench"] as const;

export const ZONES = ["knees", "back", "shoulders", "wrists", "hips"] as const;
export type Zone = (typeof ZONES)[number];

export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

export const TRAINING_GOALS = ["weight_loss", "strength", "muscle", "endurance", "mobility"] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const PLACES = ["home_none", "home_equipped", "gym", "outdoor"] as const;
export type Place = (typeof PLACES)[number];

export const SESSION_MINUTES = [15, 30, 45, 60] as const;

export const FEELINGS = ["easy", "good", "hard"] as const;
export type Feeling = (typeof FEELINGS)[number];

export const FOCUSES = ["full_body", "upper", "lower", "cardio", "mobility"] as const;
export type Focus = (typeof FOCUSES)[number];

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  /** Tout le matériel nécessaire ; vide = poids du corps. */
  equipment: Exclude<Equipment, "none">[];
  /** 1 = accessible à tous, 3 = confirmé. */
  level: 1 | 2 | 3;
  phase: "warmup" | "main" | "cooldown";
  /** Répétitions, ou durée (gainage, cardio, étirements). */
  mode: "reps" | "time";
  /** Équivalent métabolique, pour estimer les calories dépensées. */
  met: number;
  /** Zones sollicitées : l'exercice est écarté si l'une d'elles est à ménager. */
  stress: Zone[];
  steps: string[];
  mistakes: string[];
  /** Variante plus douce, toujours proposée. */
  easier: string;
  harder: string | null;
};

export type TrainingProfile = {
  level: TrainingLevel;
  goal: TrainingGoal;
  place: Place;
  equipment: Exclude<Equipment, "none">[];
  /** Jours disponibles, 0 = lundi. */
  days: number[];
  minutes: (typeof SESSION_MINUTES)[number];
  avoidZones: Zone[];
  /** Exercices signalés douloureux, écartés des séances. */
  excluded: string[];
};

/** Un exercice prescrit : séries de répétitions ou de durée, avec le repos entre séries. */
export type Prescription = {
  exerciseId: string;
  sets: number;
  reps: number | null;
  seconds: number | null;
  restSeconds: number;
};

export type PlannedSession = {
  /** Jour de la semaine (0 = lundi), ou null pour une séance express ou à la demande. */
  day: number | null;
  focus: Focus;
  minutes: number;
  warmup: Prescription[];
  main: Prescription[];
  cooldown: Prescription[];
  /** Titre et conseil du coach (personnalisation par le LLM, facultative). */
  title?: string;
  tip?: string;
};

export type LoggedSet = { reps: number | null; weightKg: number | null; seconds: number | null };
export type LoggedExercise = { exerciseId: string; sets: LoggedSet[] };
