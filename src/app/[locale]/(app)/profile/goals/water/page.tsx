import { setRequestLocale } from "next-intl/server";

import { WaterEditor } from "@/features/goals/editors";
import { toLocale } from "@/i18n/routing";

import { goalData } from "../goal-data";

export default async function WaterPage({ params }: PageProps<"/[locale]/profile/goals/water">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const { profile } = await goalData(locale);
  return <WaterEditor glasses={profile.waterGoalGlasses} />;
}
