/** Valeurs métier du profil, partagées par la base, les formulaires et le calcul. */

export const SEXES = ["female", "male"] as const;
export type Sex = (typeof SEXES)[number];

export const GOALS = ["lose_weight", "maintain", "gain_muscle", "eat_balanced"] as const;
export type Goal = (typeof GOALS)[number];

/** Objectifs proposés aux moins de 18 ans : jamais de perte de poids ni de prise de masse. */
export const MINOR_GOALS = ["maintain", "eat_balanced"] as const satisfies readonly Goal[];

export const PACES = ["gentle", "moderate"] as const;
export type Pace = (typeof PACES)[number];

/** 1 = sédentaire … 5 = très actif. */
export const ACTIVITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const DIETS = ["omnivore", "flexitarian", "pescatarian", "vegetarian", "vegan", "no_pork"] as const;
export type Diet = (typeof DIETS)[number];

export const BUDGET_MODES = ["daily", "weekly"] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

/** Anciennes personnalités du coach, gardées pour la colonne `profiles.coach_style` (DECISIONS 029). */
export const COACH_STYLES = ["teacher", "cheerleader", "zen", "chef"] as const;
export type CoachStyle = (typeof COACH_STYLES)[number];

export const ADULT_AGE = 18;

/** Âge révolu à une date donnée (dates ISO « AAAA-MM-JJ »). */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function isMinor(birthDate: string, on: string): boolean {
  return ageOn(birthDate, on) < ADULT_AGE;
}

export function allowedGoals(birthDate: string, on: string): readonly Goal[] {
  return isMinor(birthDate, on) ? MINOR_GOALS : GOALS;
}

/** Le rythme et le poids cible n'ont de sens que pour un objectif de changement de poids. */
export function goalChangesWeight(goal: Goal): goal is "lose_weight" | "gain_muscle" {
  return goal === "lose_weight" || goal === "gain_muscle";
}
