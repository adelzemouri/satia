/**
 * Moteur de calcul énergétique (calcul pur, aucun I/O).
 * Références : Mifflin-St Jeor (1990) pour le métabolisme de base,
 * facteurs d'activité usuels de la FAO/OMS, 7 700 kcal ≈ 1 kg de masse grasse.
 */
import { type ActivityLevel, ageOn, allowedGoals, type Goal, goalChangesWeight, type Pace, type Sex } from "./profile";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };

export const KCAL_PER_KG = 7700;

/** Planchers par défaut ; l'admin peut les modifier (réglage `calorie_floors`). */
export const DEFAULT_CALORIE_FLOORS: CalorieFloors = { female: 1200, male: 1500 };
export type CalorieFloors = Record<Sex, number>;

/** Perte de poids visée plafonnée à 1 % du poids corporel par semaine. */
export const MAX_WEEKLY_LOSS_RATIO = 0.01;

const LOSS_KG_PER_WEEK: Record<Pace, number> = { gentle: 0.25, moderate: 0.5 };
const GAIN_SURPLUS_KCAL: Record<Pace, number> = { gentle: 150, moderate: 300 };
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_weight: 1.6,
  gain_muscle: 1.8,
  maintain: 1.2,
  eat_balanced: 1.2,
};
const FAT_SHARE = 0.3;
const MIN_HEALTHY_BMI = 18.5;
const REFERENCE_BMI_CAP = 30;
const REFERENCE_BMI = 25;

export type PlanInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  goal: Goal;
  pace: Pace;
  activityLevel: ActivityLevel;
  /** Date du calcul, « AAAA-MM-JJ ». */
  today: string;
  floors?: CalorieFloors;
};

export type PlanNotice =
  /** L'objectif a été remonté au plancher calorique. */
  | "floor_applied"
  /** Le rythme demandé dépassait 1 % du poids par semaine et a été réduit. */
  | "loss_capped";

export type Plan = {
  age: number;
  bmr: number;
  tdee: number;
  kcal: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  /** Variation de poids attendue par semaine (négative en perte). */
  weeklyChangeKg: number;
  /** Date estimée d'atteinte du poids cible, si pertinent. */
  estimatedGoalDate: string | null;
  notices: PlanNotice[];
};

export type TargetWeightIssue = "wrong_direction" | "below_healthy_bmi";

export function bmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

export function basalMetabolicRate(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** Vérifie la cohérence du poids cible avec l'objectif ; `null` si tout va bien. */
export function checkTargetWeight(
  goal: Goal,
  weightKg: number,
  heightCm: number,
  targetWeightKg: number,
): TargetWeightIssue | null {
  if (goal === "lose_weight" && targetWeightKg >= weightKg) return "wrong_direction";
  if (goal === "gain_muscle" && targetWeightKg <= weightKg) return "wrong_direction";
  if (bmi(targetWeightKg, heightCm) < MIN_HEALTHY_BMI) return "below_healthy_bmi";
  return null;
}

/** Poids le plus bas compatible avec un IMC de 18,5, arrondi au dixième supérieur. */
export function minHealthyWeightKg(heightCm: number): number {
  return Math.ceil(MIN_HEALTHY_BMI * (heightCm / 100) ** 2 * 10) / 10;
}

export function computePlan(input: PlanInput): Plan {
  const floors = input.floors ?? DEFAULT_CALORIE_FLOORS;
  if (!allowedGoals(input.birthDate, input.today).includes(input.goal)) {
    throw new Error(`Objectif ${input.goal} non autorisé pour ce profil`);
  }

  const age = ageOn(input.birthDate, input.today);
  const bmr = basalMetabolicRate(input.sex, input.weightKg, input.heightCm, age);
  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];
  const notices: PlanNotice[] = [];

  let target = tdee;
  if (input.goal === "lose_weight") {
    const requested = LOSS_KG_PER_WEEK[input.pace];
    const cap = input.weightKg * MAX_WEEKLY_LOSS_RATIO;
    if (requested > cap) notices.push("loss_capped");
    target = tdee - (Math.min(requested, cap) * KCAL_PER_KG) / 7;
  } else if (input.goal === "gain_muscle") {
    target = tdee + GAIN_SURPLUS_KCAL[input.pace];
  }

  const floor = floors[input.sex];
  if (target < floor) {
    target = floor;
    notices.push("floor_applied");
  }
  const kcal = Math.round(target / 10) * 10;
  const weeklyChangeKg = round2(((kcal - tdee) * 7) / KCAL_PER_KG);

  return {
    age,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal,
    macros: macrosFor(kcal, input),
    weeklyChangeKg,
    estimatedGoalDate: estimateGoalDate(input, weeklyChangeKg),
    notices,
  };
}

function macrosFor(kcal: number, input: PlanInput): Plan["macros"] {
  // Au-delà d'un IMC de 30, les protéines se calculent sur un poids de référence (IMC 25).
  const referenceWeight =
    bmi(input.weightKg, input.heightCm) > REFERENCE_BMI_CAP
      ? REFERENCE_BMI * (input.heightCm / 100) ** 2
      : input.weightKg;
  const proteinG = Math.round(PROTEIN_G_PER_KG[input.goal] * referenceWeight);
  const fatG = Math.round((kcal * FAT_SHARE) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, carbsG, fatG };
}

function estimateGoalDate(input: PlanInput, weeklyChangeKg: number): string | null {
  const target = input.targetWeightKg;
  if (!goalChangesWeight(input.goal) || target == null || weeklyChangeKg === 0) return null;
  const remaining = target - input.weightKg;
  if (Math.sign(remaining) !== Math.sign(weeklyChangeKg)) return null;
  const days = Math.ceil((remaining / weeklyChangeKg) * 7);
  return addDays(input.today, days);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
