import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getGoalOn, getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  const goal = await getGoalOn(user.id);
  const t = await getTranslations();

  const macros = goal
    ? [
        { key: "protein", value: goal.proteinG, color: "bg-protein" },
        { key: "carbs", value: goal.carbsG, color: "bg-carbs" },
        { key: "fat", value: goal.fatG, color: "bg-fat" },
      ]
    : [];

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("home.greeting", { name: profile.firstName })}</h1>
      {goal && (
        <Card aria-labelledby="goal-title">
          <h2 id="goal-title" className="font-semibold text-text-muted">
            {t("home.todayGoal")}
          </h2>
          <p className="font-display text-5xl font-semibold">{t("common.kcal", { value: goal.kcal })}</p>
          <h3 className="sr-only">{t("home.macros")}</h3>
          <ul className="grid grid-cols-3 gap-3">
            {macros.map((macro) => (
              <li key={macro.key} className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className={`size-3 rounded-full ${macro.color}`} />
                  {t(`home.${macro.key}` as "home.protein")}
                </span>
                <span className="text-xl font-semibold">{t("common.grams", { value: macro.value })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-text-muted">{t("home.comingSoon")}</p>
      <p className="mt-auto text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
