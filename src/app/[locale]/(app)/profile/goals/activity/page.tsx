import { setRequestLocale } from "next-intl/server";

import { ActivityEditor } from "@/features/goals/editors";
import { toLocale } from "@/i18n/routing";

import { goalData } from "../goal-data";

export default async function ActivityPage({ params }: PageProps<"/[locale]/profile/goals/activity">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const { profile } = await goalData(locale);
  return <ActivityEditor level={profile.activityLevel} />;
}
