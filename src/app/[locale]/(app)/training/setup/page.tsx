import { getTranslations, setRequestLocale } from "next-intl/server";

import { TrainingProfileForm } from "@/features/training/profile-form";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { getTrainingProfile } from "@/server/training";
import { Card } from "@/ui/card";

export default async function TrainingSetupPage({ params }: PageProps<"/[locale]/training/setup">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getTrainingProfile(user.id);
  const t = await getTranslations("training");
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("setup.title")}</h1>
      <p className="text-text-muted">{t("setup.intro")}</p>
      <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm">{t("disclaimer")}</p>
      <Card>
        <TrainingProfileForm
          initial={
            profile && {
              level: profile.level,
              goal: profile.goal,
              place: profile.place,
              equipment: profile.equipment,
              days: profile.days,
              minutes: profile.minutes,
              avoidZones: profile.avoidZones,
            }
          }
        />
      </Card>
    </>
  );
}
