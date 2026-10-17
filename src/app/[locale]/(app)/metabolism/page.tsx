import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import {
  daysBetween,
  type Measurement,
  MIN_DAYS,
  type MissingData,
  weightDirection,
  WINDOW_DAYS,
} from "@/domain/adaptive";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
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
  /** Ce qui manquait pour un bilan, en une phrase (« 4 jours de suivi et 1 pesée sur la période »). */
  const missingList = (missing: MissingData) =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(
      [
        missing.days > 0 && t("missingDays", { count: missing.days }),
        missing.weighIns > 0 && t("missingWeighIns", { count: missing.weighIns }),
        missing.loggedDays > 0 && t("missingLogged", { count: missing.loggedDays }),
      ].filter((item) => typeof item === "string"),
    );

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>

      <Card aria-labelledby="expenditure-title">
        <h2 id="expenditure-title" className="text-xl font-semibold">
          {t("expenditure")}
        </h2>
        {measurement.status === "measured" && (
          <MeasuredExpenditure
            measurement={measurement}
            startTdee={overview.startTdee}
            estimatedTdee={overview.estimatedTdee}
          />
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
        {measurement.status !== "measured" && (
          <p className="text-sm text-text-muted">{t("formulaMeanwhile", { value: overview.estimatedTdee })}</p>
        )}
      </Card>

      <Card aria-labelledby="goal-title">
        <h2 id="goal-title" className="text-xl font-semibold">
          {t("goal")}
        </h2>
        <p className="font-display text-3xl font-extrabold tracking-tight">
          {t("kcalPerDay", { value: overview.goalKcal })}
        </p>
        <p className="text-text-muted">{t(`source.${overview.goalSource}`)}</p>
        <GoalLockForm
          locked={overview.goalLocked}
          nextCheck={formatDay(addDays(isoWeekStart(todayIso()), 7), locale)}
        />
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
                  {check.status === "insufficient" && check.missing
                    ? t("status.insufficientDetail", { list: missingList(check.missing) })
                    : t(`status.${check.status}`, {
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

/** La dépense réelle et son calcul en trois lignes ; les chiffres de la formule restent repliés. */
async function MeasuredExpenditure({
  measurement,
  startTdee,
  estimatedTdee,
}: {
  measurement: Extract<Measurement, { status: "measured" }>;
  startTdee: number;
  estimatedTdee: number;
}) {
  const t = await getTranslations("metabolism");
  const direction = weightDirection(measurement.weeklyChangeKg);
  return (
    <>
      <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
        {t("kcalPerDay", { value: measurement.tdee })}{" "}
        <span className="font-sans text-base font-medium tracking-normal text-text-muted">{t("perDay")}</span>
      </p>
      <p>{t(`direction.${direction}`)}</p>
      <dl aria-label={t("calcLabel")} className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-3 tabular-nums">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0">
            {t("calcIntake")}
            <span className="block text-sm text-text-muted">
              {t("calcIntakeDetail", { days: daysBetween(measurement.from, measurement.to) + 1 })}
            </span>
          </dt>
          <dd className="font-semibold whitespace-nowrap">{t("kcalPerDay", { value: measurement.averageIntake })}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0">
            {t(`calcWeight.${direction}`)}
            <span className="block text-sm text-text-muted">
              {t("calcWeightDetail", { change: measurement.weeklyChangeKg })}
            </span>
          </dt>
          <dd className="font-semibold whitespace-nowrap">
            {t("calcCorrection", { value: measurement.tdee - measurement.averageIntake })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 font-bold">
          <dt>{t("calcTotal")}</dt>
          <dd className="whitespace-nowrap text-primary">{t("kcalPerDay", { value: measurement.tdee })}</dd>
        </div>
      </dl>
      <details className="group border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-primary [&::-webkit-details-marker]:hidden">
          {t("formulaToggle")}
          <span
            aria-hidden
            className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
          >
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-2 pt-2 text-sm text-text-muted">
          <p>{t("formulaStart", { value: startTdee })}</p>
          <p>{t("formulaNow", { value: estimatedTdee })}</p>
          <p>{t("formulaWhy")}</p>
        </div>
      </details>
    </>
  );
}
