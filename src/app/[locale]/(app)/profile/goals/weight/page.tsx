import { setRequestLocale } from "next-intl/server";

import { minHealthyWeightKg } from "@/domain/energy";
import { goalChangesWeight } from "@/domain/profile";
import { TargetWeightEditor } from "@/features/goals/editors";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";

import { goalData } from "../goal-data";

/** Haut de la zone de poids de forme (IMC 25), pour le repère affiché sous la règle. */
const MAX_HEALTHY_BMI = 25;

export default async function TargetWeightPage({ params }: PageProps<"/[locale]/profile/goals/weight">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const { profile, currentKg } = await goalData(locale);
  // Maintenir ou équilibrer : pas de poids visé.
  if (!goalChangesWeight(profile.goal)) return redirect({ href: "/profile/goals/objective", locale });
  const maxHealthy = Math.floor(MAX_HEALTHY_BMI * (profile.heightCm / 100) ** 2 * 10) / 10;
  return (
    <TargetWeightEditor
      current={currentKg}
      target={profile.targetWeightKg}
      goal={profile.goal}
      minHealthy={minHealthyWeightKg(profile.heightCm)}
      maxHealthy={maxHealthy}
    />
  );
}
