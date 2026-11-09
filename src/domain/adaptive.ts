/**
 * Objectif adaptatif (calcul pur, aucun appel LLM) : la dépense réelle se déduit de ce
 * qui a été mangé et de l'évolution de la tendance de poids (pas des pesées brutes).
 */
import { addDays, type CalorieFloors, DEFAULT_CALORIE_FLOORS, KCAL_PER_KG, targetFromTdee } from "./energy";
import type { Goal, Pace, Sex } from "./profile";
import { weightTrend, type WeighIn } from "./weight-trend";

/** Période d'observation : les 28 derniers jours complets, 14 au minimum. */
export const WINDOW_DAYS = 28;
export const MIN_DAYS = 14;
export const MIN_WEIGH_INS = 3;
export const MIN_LOGGED_SHARE = 0.8;
/** Ajustement maximal d'une semaine à l'autre. */
export const MAX_WEEKLY_STEP_KCAL = 150;
/** En dehors de ces bornes, les données sont jugées incohérentes (saisie très incomplète…). */
const PLAUSIBLE_TDEE = { min: 1000, max: 5000 } as const;

export type MissingData = {
  /** Jours d'historique manquants avant les 14 requis. */
  days: number;
  /** Pesées manquantes sur la période. */
  weighIns: number;
  /** Jours saisis manquants pour atteindre 80 % de la période. */
  loggedDays: number;
};

export type Measurement =
  | {
      status: "measured";
      tdee: number;
      from: string;
      to: string;
      /** Apport moyen des jours saisis. */
      averageIntake: number;
      /** Variation de la tendance de poids sur la période, en kg par semaine. */
      weeklyChangeKg: number;
    }
  | { status: "insufficient"; missing: MissingData }
  | { status: "inconsistent"; tdee: number };

/**
 * Mesure la dépense sur la période qui se termine la veille de `today`.
 * `intakes` : calories par jour saisi ; `firstDay` : premier jour d'utilisation.
 */
export function measureExpenditure(input: {
  today: string;
  firstDay: string;
  intakes: ReadonlyMap<string, number>;
  weighIns: readonly WeighIn[];
}): Measurement {
  const to = addDays(input.today, -1);
  const history = daysBetween(input.firstDay, to) + 1;
  const length = Math.min(WINDOW_DAYS, Math.max(0, history));
  const from = addDays(to, -(length - 1));

  const loggedDays = [...input.intakes.keys()].filter((date) => date >= from && date <= to);
  const weighIns = input.weighIns.filter((entry) => entry.date >= from && entry.date <= to);
  const missing: MissingData = {
    days: Math.max(0, MIN_DAYS - length),
    weighIns: Math.max(0, MIN_WEIGH_INS - weighIns.length),
    loggedDays: Math.max(0, Math.ceil(MIN_LOGGED_SHARE * Math.max(length, MIN_DAYS)) - loggedDays.length),
  };
  if (missing.days > 0 || missing.weighIns > 0 || missing.loggedDays > 0) return { status: "insufficient", missing };

  // Tendance lissée sur tout l'historique (pour un point de départ stable), pente sur la période.
  const trend = weightTrend(input.weighIns.filter((entry) => entry.date <= to)).filter((point) => point.date >= from);
  const kgPerDay = slope(trend.map((point) => point.trendKg));
  const averageIntake = loggedDays.reduce((sum, date) => sum + (input.intakes.get(date) ?? 0), 0) / loggedDays.length;
  const tdee = Math.round(averageIntake - kgPerDay * KCAL_PER_KG);
  if (tdee < PLAUSIBLE_TDEE.min || tdee > PLAUSIBLE_TDEE.max) return { status: "inconsistent", tdee };
  return {
    status: "measured",
    tdee,
    from,
    to,
    averageIntake: Math.round(averageIntake),
    weeklyChangeKg: Math.round(kgPerDay * 7 * 100) / 100,
  };
}

export type AdaptedGoal = {
  kcal: number;
  /** Nouvel objectif visé avant la limite de ±150 kcal. */
  idealKcal: number;
  /** L'ajustement a été limité à ±150 kcal. */
  stepCapped: boolean;
};

/**
 * Nouvel objectif à partir de la dépense mesurée : même logique que le calcul de départ
 * (déficit, surplus, plafond de perte, plancher), puis rapproché de l'objectif actuel
 * d'au plus 150 kcal.
 */
export function adaptGoal(input: {
  currentKcal: number;
  measuredTdee: number;
  goal: Goal;
  pace: Pace;
  sex: Sex;
  weightKg: number;
  floors?: CalorieFloors;
}): AdaptedGoal {
  const floors = input.floors ?? DEFAULT_CALORIE_FLOORS;
  const ideal = roundTo10(targetFromTdee(input.measuredTdee, input, floors).target);
  const step = Math.max(-MAX_WEEKLY_STEP_KCAL, Math.min(MAX_WEEKLY_STEP_KCAL, ideal - input.currentKcal));
  const kcal = Math.max(floors[input.sex], roundTo10(input.currentKcal + step));
  return { kcal, idealKcal: ideal, stepCapped: Math.abs(ideal - input.currentKcal) > MAX_WEEKLY_STEP_KCAL };
}

function roundTo10(value: number): number {
  // Arrondi vers zéro pour qu'un pas de 150 ne devienne jamais 160.
  return Math.trunc(value / 10) * 10;
}

/** Pente (régression linéaire) d'une série journalière, en unités par jour. */
function slope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((value, x) => {
    num += (x - meanX) * (value - meanY);
    den += (x - meanX) ** 2;
  });
  return num / den;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** En deçà de 0,1 kg par semaine, la tendance de poids est présentée comme stable. */
export const STABLE_WEIGHT_KG_PER_WEEK = 0.1;

export type WeightDirection = "stable" | "down" | "up";

/** Sens de la tendance de poids, pour l'expliquer en mots plutôt qu'en kilos. */
export function weightDirection(weeklyChangeKg: number): WeightDirection {
  if (Math.abs(weeklyChangeKg) < STABLE_WEIGHT_KG_PER_WEEK) return "stable";
  return weeklyChangeKg < 0 ? "down" : "up";
}

/** Sous 100 kcal d'écart, on considère que l'apport moyen colle à l'objectif. */
export const ON_TARGET_KCAL = 100;

export type GoalKind = "lose" | "gain" | "steady";

/** L'objectif du profil ramené à son sens : on vise une baisse, une hausse ou un poids stable. */
export function goalKind(goal: Goal): GoalKind {
  if (goal === "lose_weight") return "lose";
  if (goal === "gain_muscle") return "gain";
  return "steady";
}

export type MetabolismSummary = {
  kind: GoalKind;
  /** Apport moyen moins objectif : négatif si l'on mange sous l'objectif. */
  gapKcal: number;
  intake: "below" | "on" | "above";
  direction: WeightDirection;
  /** Le poids va dans le sens visé (ou reste stable quand c'est le but). */
  asPlanned: boolean;
  /** Échelle de « mangé », « dépense » et « objectif », en % de la largeur. */
  scale: { intake: number; tdee: number; goal: number };
};

/**
 * L'essentiel de « Mon métabolisme » en une comparaison : ce qui est mangé face à
 * l'objectif, et ce que ça donne sur la balance. Calcul pur, aucun appel LLM.
 */
export function metabolismSummary(input: {
  averageIntake: number;
  tdee: number;
  goalKcal: number;
  weeklyChangeKg: number;
  goal: Goal;
}): MetabolismSummary {
  const kind = goalKind(input.goal);
  const gapKcal = Math.round(input.averageIntake - input.goalKcal);
  const intake = Math.abs(gapKcal) < ON_TARGET_KCAL ? "on" : gapKcal < 0 ? "below" : "above";
  const direction = weightDirection(input.weeklyChangeKg);
  const wanted: WeightDirection = kind === "lose" ? "down" : kind === "gain" ? "up" : "stable";
  return {
    kind,
    gapKcal,
    intake,
    direction,
    asPlanned: direction === wanted,
    scale: scalePositions([input.averageIntake, input.tdee, input.goalKcal]),
  };
}

/** Place les trois valeurs sur une échelle qui laisse de la marge de chaque côté (au moins 600 kcal). */
function scalePositions([intake, tdee, goal]: [number, number, number]): MetabolismSummary["scale"] {
  const low = Math.min(intake, tdee, goal);
  const high = Math.max(intake, tdee, goal);
  const span = Math.max(600, (high - low) * 1.6);
  const start = (low + high) / 2 - span / 2;
  const at = (kcal: number) => Math.round(((kcal - start) / span) * 1000) / 10;
  return { intake: at(intake), tdee: at(tdee), goal: at(goal) };
}

/** Un bilan hebdomadaire tel qu'enregistré (les champs utiles au regroupement). */
export type WeeklyCheck = {
  weekStart: string;
  status: "adjusted" | "unchanged" | "locked" | "insufficient" | "inconsistent";
  measuredTdee: number | null;
};

export type CheckRow<T extends WeeklyCheck> =
  { kind: "week"; check: T } | { kind: "pending"; from: string; to: string; checks: T[] };

/**
 * Bilans du plus récent au plus ancien ; les semaines d'affilée sans dépense mesurée
 * (pas assez de données, données incomplètes) tiennent sur une seule ligne.
 */
export function checkRows<T extends WeeklyCheck>(history: readonly T[]): CheckRow<T>[] {
  const rows: CheckRow<T>[] = [];
  for (const check of [...history].sort((a, b) => b.weekStart.localeCompare(a.weekStart))) {
    const measured = check.status !== "insufficient" && check.status !== "inconsistent";
    const last = rows.at(-1);
    if (measured) rows.push({ kind: "week", check });
    else if (last?.kind === "pending") {
      last.from = check.weekStart;
      last.checks.push(check);
    } else rows.push({ kind: "pending", from: check.weekStart, to: check.weekStart, checks: [check] });
  }
  return rows;
}
