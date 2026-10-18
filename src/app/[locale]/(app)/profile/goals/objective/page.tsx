import { setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { allowedGoals } from "@/domain/profile";
import { ObjectiveEditor } from "@/features/goals/editors";
import { toLocale } from "@/i18n/routing";

import { goalData } from "../goal-data";

export default async function ObjectivePage({ params }: PageProps<"/[locale]/profile/goals/objective">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const { profile } = await goalData(locale);
  return (
    <ObjectiveEditor goal={profile.goal} pace={profile.pace} allowed={allowedGoals(profile.birthDate, todayIso())} />
  );
}
