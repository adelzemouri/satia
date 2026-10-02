import { describe, expect, it } from "vitest";

import {
  addDays,
  basalMetabolicRate,
  checkTargetWeight,
  computePlan,
  minHealthyWeightKg,
  type PlanInput,
} from "@/domain/energy";
import { ageOn, allowedGoals, isMinor } from "@/domain/profile";

const base: PlanInput = {
  sex: "female",
  birthDate: "1990-06-15",
  heightCm: 165,
  weightKg: 70,
  goal: "maintain",
  pace: "gentle",
  activityLevel: 2,
  today: "2026-10-02",
};

describe("âge", () => {
  it("compte les années révolues", () => {
    expect(ageOn("1990-06-15", "2026-06-14")).toBe(35);
    expect(ageOn("1990-06-15", "2026-06-15")).toBe(36);
    expect(ageOn("2008-10-03", "2026-10-02")).toBe(17);
  });

  it("limite les objectifs des mineurs au maintien et à l'équilibre", () => {
    expect(isMinor("2009-01-01", "2026-10-02")).toBe(true);
    expect(allowedGoals("2009-01-01", "2026-10-02")).toEqual(["maintain", "eat_balanced"]);
    expect(allowedGoals("2008-10-02", "2026-10-02")).toContain("lose_weight");
  });
});

describe("métabolisme de base (Mifflin-St Jeor)", () => {
  it("applique la formule femme", () => {
    // 10×70 + 6,25×165 − 5×36 − 161
    expect(basalMetabolicRate("female", 70, 165, 36)).toBeCloseTo(1390.25);
  });

  it("applique la formule homme", () => {
    // 10×80 + 6,25×180 − 5×40 + 5
    expect(basalMetabolicRate("male", 80, 180, 40)).toBeCloseTo(1730);
  });
});

describe("computePlan", () => {
  it("maintien : objectif = dépense totale, arrondie à 10 kcal", () => {
    const plan = computePlan(base);
    expect(plan.age).toBe(36);
    expect(plan.bmr).toBe(1390);
    expect(plan.tdee).toBe(1912); // 1390,25 × 1,375
    expect(plan.kcal).toBe(1910);
    expect(plan.weeklyChangeKg).toBeCloseTo(0, 1);
    expect(plan.notices).toEqual([]);
  });

  it("perte douce : 0,25 kg/semaine soit 275 kcal de déficit", () => {
    const plan = computePlan({ ...base, goal: "lose_weight", activityLevel: 3, targetWeightKg: 65 });
    expect(plan.tdee).toBe(2155); // 1390,25 × 1,55
    expect(plan.kcal).toBe(1880);
    expect(plan.weeklyChangeKg).toBeCloseTo(-0.25, 1);
    expect(plan.estimatedGoalDate).toBe("2027-02-19"); // 5 kg à 0,25 kg/semaine = 20 semaines;
  });

  it("plafonne la perte à 1 % du poids par semaine", () => {
    const plan = computePlan({
      ...base,
      weightKg: 45,
      heightCm: 150,
      goal: "lose_weight",
      pace: "moderate",
      activityLevel: 5,
    });
    expect(plan.notices).toContain("loss_capped");
    expect(plan.weeklyChangeKg).toBeGreaterThanOrEqual(-0.45);
  });

  it("ne descend jamais sous le plancher (femme 1200)", () => {
    const plan = computePlan({
      ...base,
      weightKg: 50,
      heightCm: 150,
      birthDate: "1950-01-01",
      goal: "lose_weight",
      pace: "moderate",
      activityLevel: 1,
    });
    expect(plan.kcal).toBe(1200);
    expect(plan.notices).toContain("floor_applied");
  });

  it("ne descend jamais sous le plancher (homme 1500)", () => {
    const plan = computePlan({
      ...base,
      sex: "male",
      weightKg: 55,
      heightCm: 160,
      birthDate: "1945-01-01",
      goal: "lose_weight",
      pace: "moderate",
      activityLevel: 1,
    });
    expect(plan.kcal).toBe(1500);
  });

  it("respecte les planchers configurés par l'admin", () => {
    const plan = computePlan({
      ...base,
      goal: "lose_weight",
      pace: "moderate",
      activityLevel: 1,
      floors: { female: 1600, male: 1800 },
    });
    expect(plan.kcal).toBe(1600);
  });

  it("prise de muscle : léger surplus et protéines relevées", () => {
    const plan = computePlan({
      ...base,
      sex: "male",
      weightKg: 75,
      heightCm: 180,
      goal: "gain_muscle",
      pace: "moderate",
      targetWeightKg: 78,
    });
    const maintain = computePlan({ ...base, sex: "male", weightKg: 75, heightCm: 180 });
    expect(plan.kcal - maintain.kcal).toBeGreaterThanOrEqual(290);
    expect(plan.macros.proteinG).toBe(135); // 1,8 × 75
    expect(plan.weeklyChangeKg).toBeGreaterThan(0);
    expect(plan.estimatedGoalDate).not.toBeNull();
  });

  it("macros : protéines par kg, 30 % de lipides, glucides en complément", () => {
    const plan = computePlan(base);
    expect(plan.macros.proteinG).toBe(84); // 1,2 × 70
    expect(plan.macros.fatG).toBe(64); // 1910 × 0,3 / 9
    expect(plan.macros.carbsG).toBe(250); // (1910 − 336 − 576) / 4
    const total = plan.macros.proteinG * 4 + plan.macros.carbsG * 4 + plan.macros.fatG * 9;
    expect(Math.abs(total - plan.kcal)).toBeLessThan(10);
  });

  it("au-delà d'un IMC de 30, les protéines utilisent un poids de référence", () => {
    const plan = computePlan({ ...base, weightKg: 110, goal: "lose_weight", targetWeightKg: 90 });
    expect(plan.macros.proteinG).toBe(109); // 1,6 × 25 × 1,65²
  });

  it("refuse un objectif de perte de poids pour un mineur", () => {
    expect(() => computePlan({ ...base, birthDate: "2010-01-01", goal: "lose_weight" })).toThrow();
    expect(computePlan({ ...base, birthDate: "2010-01-01", goal: "eat_balanced" }).kcal).toBeGreaterThan(0);
  });

  it("pas de date estimée sans poids cible ni pour le maintien", () => {
    expect(computePlan({ ...base, goal: "lose_weight" }).estimatedGoalDate).toBeNull();
    expect(computePlan({ ...base, targetWeightKg: 60 }).estimatedGoalDate).toBeNull();
  });
});

describe("poids cible", () => {
  it("doit aller dans le sens de l'objectif", () => {
    expect(checkTargetWeight("lose_weight", 70, 165, 72)).toBe("wrong_direction");
    expect(checkTargetWeight("gain_muscle", 70, 165, 68)).toBe("wrong_direction");
    expect(checkTargetWeight("lose_weight", 70, 165, 64)).toBeNull();
  });

  it("ne peut pas viser un IMC inférieur à 18,5", () => {
    expect(minHealthyWeightKg(165)).toBe(50.4);
    expect(checkTargetWeight("lose_weight", 60, 165, 50)).toBe("below_healthy_bmi");
    expect(checkTargetWeight("lose_weight", 60, 165, 50.4)).toBeNull();
  });
});

it("addDays gère les changements de mois et d'année", () => {
  expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
});
