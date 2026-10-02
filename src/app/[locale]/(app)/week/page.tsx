import { getTranslations, setRequestLocale } from "next-intl/server";

import { BudgetModeForm } from "@/features/adaptive/budget-mode-form";
import { LargerDayToggle } from "@/features/adaptive/larger-day-toggle";
import { WeekGauge } from "@/features/adaptive/week-gauge";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck, weekBudget } from "@/server/adaptive";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";

export default async function WeekPage({ params }: PageProps<"/[locale]/week">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  await ensureWeeklyCheck(user.id);
  const week = profile.budgetMode === "weekly" ? await weekBudget(user.id) : null;
  const t = await getTranslations("week");

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>

      <Card aria-labelledby="mode-title">
        <h2 id="mode-title" className="text-xl font-semibold">
          {t("mode")}
        </h2>
        <BudgetModeForm mode={profile.budgetMode} />
      </Card>

      {week ? (
        <Card aria-labelledby="days-title">
          <h2 id="days-title" className="text-xl font-semibold">
            {t("daysTitle")}
          </h2>
          <WeekGauge consumed={week.consumed} total={week.total} />
          {week.overspent && <p className="rounded-2xl bg-surface-muted px-4 py-3">{t("overspent")}</p>}
          <p className="text-text-muted">{t("largerHint")}</p>
          <ul className="flex flex-col divide-y divide-border">
            {week.days.map((day) => {
              const label = formatDay(day.date, locale);
              const isToday = day.date === week.days.find((other) => !other.past)?.date;
              return (
                <li key={day.date} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold first-letter:uppercase">
                      {label}
                      {isToday && <span className="font-normal text-text-muted"> · {t("today")}</span>}
                    </span>
                    <span className="text-sm text-text-muted">
                      {!day.past
                        ? t("target", { kcal: day.kcal })
                        : day.consumed === null
                          ? t("notLogged")
                          : t("pastDay", { consumed: Math.round(day.consumed) })}
                    </span>
                  </span>
                  {!day.past && <LargerDayToggle date={day.date} larger={day.larger} dayLabel={label} />}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <p className="text-text-muted">{t("dailyHint")}</p>
      )}
    </>
  );
}
