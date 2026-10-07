import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { daysBetween, MIN_DAYS, WINDOW_DAYS } from "@/domain/adaptive";
import { GoalLockForm } from "@/features/adaptive/goal-lock-form";
import { TdeeChart } from "@/features/adaptive/tdee-chart";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck, metabolismOverview } from "@/server/adaptive";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { Columns } from "@/ui/columns";

export default async function MetabolismPage({ params }: PageProps<"/[locale]/metabolism">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  await ensureWeeklyCheck(user.id);
  const overview = await metabolismOverview(user.id);
  if (!overview) return redirect({ href: "/onboarding", locale });
  const t = await getTranslations("metabolism");
  const { measurement } = overview;

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>

      <Card aria-labelledby="expenditure-title">
        <h2 id="expenditure-title" className="text-xl font-semibold">
          {t("expenditure")}
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3">
            <dt className="text-sm font-semibold text-text-muted">{t("startEstimate")}</dt>
            <dd className="font-display text-2xl font-extrabold tracking-tight">
              {t("kcalPerDay", { value: overview.startTdee })}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3">
            <dt className="text-sm font-semibold text-text-muted">{t("measured")}</dt>
            <dd className="font-display text-2xl font-extrabold tracking-tight">
              {measurement.status === "measured" ? t("kcalPerDay", { value: measurement.tdee }) : t("notYet")}
            </dd>
          </div>
        </dl>
        {measurement.status === "measured" && (
          <p>
            {t("measuredDetail", {
              days: daysBetween(measurement.from, measurement.to) + 1,
              intake: measurement.averageIntake,
              change: measurement.weeklyChangeKg,
            })}
          </p>
        )}
        {measurement.status === "insufficient" && (
          <>
            <p>{t("insufficient", { days: MIN_DAYS })}</p>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {measurement.missing.days > 0 && <li>{t("missingDays", { count: measurement.missing.days })}</li>}
              {measurement.missing.weighIns > 0 && (
                <li>{t("missingWeighIns", { count: measurement.missing.weighIns })}</li>
              )}
              {measurement.missing.loggedDays > 0 && (
                <li>{t("missingLogged", { count: measurement.missing.loggedDays })}</li>
              )}
            </ul>
          </>
        )}
        {measurement.status === "inconsistent" && <p>{t("inconsistent")}</p>}
        <p className="text-sm text-text-muted">{t("currentEstimate", { value: overview.estimatedTdee })}</p>
      </Card>

      <Card aria-labelledby="goal-title">
        <h2 id="goal-title" className="text-xl font-semibold">
          {t("goal")}
        </h2>
        <p className="font-display text-3xl font-extrabold tracking-tight">
          {t("kcalPerDay", { value: overview.goalKcal })}
        </p>
        <p className="text-text-muted">{t(`source.${overview.goalSource}`)}</p>
        <GoalLockForm locked={overview.goalLocked} />
      </Card>

      {overview.history.length > 0 && (
        <Card aria-labelledby="history-title">
          <h2 id="history-title" className="text-xl font-semibold">
            {t("history")}
          </h2>
          <TdeeChart points={overview.history} label={t("chart")} />
          <ul className="flex flex-col divide-y divide-border">
            {[...overview.history].reverse().map((check) => (
              <li key={check.weekStart} className="flex flex-col gap-0.5 py-2">
                <span className="font-semibold">{t("weekOf", { date: formatDay(check.weekStart, locale) })}</span>
                <span className="text-sm text-text-muted">
                  {t(`status.${check.status}`, {
                    before: check.kcalBefore,
                    after: check.kcalAfter,
                    measured: check.measuredTdee ?? 0,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl font-semibold">
          {t("howTitle")}
        </h2>
        <p>{t("how1", { days: WINDOW_DAYS })}</p>
        <p>{t("how2")}</p>
        <p>{t("how3")}</p>
      </Card>

      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </Columns>
  );
}
