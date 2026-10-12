import { z } from "zod";

import { todayIso } from "@/domain/dates";
import { checkTargetWeight } from "@/domain/energy";
import {
  ACTIVITY_LEVELS,
  allowedGoals,
  BUDGET_MODES,
  DIETS,
  goalChangesWeight,
  GOALS,
  PACES,
  SEXES,
} from "@/domain/profile";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid_time");

/** Réponses du questionnaire, validées à l'identique côté client et côté serveur. */
export const onboardingSchema = z
  .object({
    firstName: z.string().trim().min(1, "required").max(40),
    sex: z.enum(SEXES, "required"),
    birthDate: z.iso.date("invalid_date"),
    heightCm: z.number("required").int().min(120, "height_range").max(230, "height_range"),
    weightKg: z.number("required").min(30, "weight_range").max(300, "weight_range"),
    goal: z.enum(GOALS, "required"),
    targetWeightKg: z.number().min(30, "weight_range").max(300, "weight_range").nullable(),
    activityLevel: z.union(
      ACTIVITY_LEVELS.map((level) => z.literal(level)),
      "required",
    ),
    pace: z.enum(PACES),
    diet: z.enum(DIETS, "required"),
    foodsToAvoid: z.string().trim().max(500),
    mealTimes: z.object({ breakfast: time, lunch: time, dinner: time }),
    budgetMode: z.enum(BUDGET_MODES),
    disclaimerAccepted: z.literal(true, "disclaimer_required"),
  })
  .superRefine((value, ctx) => {
    const today = todayIso();
    if (value.birthDate > today || value.birthDate < "1900-01-01") {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "invalid_date" });
      return;
    }
    if (!allowedGoals(value.birthDate, today).includes(value.goal)) {
      ctx.addIssue({ code: "custom", path: ["goal"], message: "goal_not_allowed" });
    }
    if (value.targetWeightKg != null && goalChangesWeight(value.goal)) {
      const issue = checkTargetWeight(value.goal, value.weightKg, value.heightCm, value.targetWeightKg);
      if (issue) ctx.addIssue({ code: "custom", path: ["targetWeightKg"], message: issue });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
