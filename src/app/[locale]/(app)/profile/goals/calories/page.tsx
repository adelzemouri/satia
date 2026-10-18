import { setRequestLocale } from "next-intl/server";

import { CaloriesEditor } from "@/features/goals/editors";
import { toLocale } from "@/i18n/routing";
import { MAX_MANUAL_KCAL } from "@/server/goal-settings";
import { getCalorieFloors } from "@/server/settings";

import { goalData } from "../goal-data";

export default async function CaloriesPage({ params }: PageProps<"/[locale]/profile/goals/calories">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const { profile, goal, currentKg } = await goalData(locale);
  const floors = await getCalorieFloors();
  return (
    <CaloriesEditor
      kcal={goal.kcal}
      locked={profile.goalLocked}
      floor={floors[profile.sex]}
      maxKcal={MAX_MANUAL_KCAL}
      macroInput={{ goal: profile.goal, weightKg: currentKg, heightCm: profile.heightCm }}
    />
  );
}
