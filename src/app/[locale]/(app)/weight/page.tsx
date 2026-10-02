import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { DeleteWeightButton } from "@/features/weight/delete-weight-button";
import { WeightChart } from "@/features/weight/weight-chart";
import { WeightForm } from "@/features/weight/weight-form";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { weightOverview } from "@/server/journal";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";

/** Nombre de jours affichés sur la courbe. */
const CHART_DAYS = 90;

export default async function WeightPage({ params }: PageProps<"/[locale]/weight">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const overview = await weightOverview(user.id);
  const t = await getTranslations("weight");
  const today = todayIso();
  const last = overview.trend.at(-1);
  const history = overview.entries.slice(-10).reverse();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>

      <Card aria-labelledby="add-weight">
        <h2 id="add-weight" className="text-xl font-semibold">
          {t("add")}
        </h2>
        <WeightForm today={today} lastWeight={overview.entries.at(-1)?.weightKg ?? null} />
      </Card>

      {last && (
        <Card aria-labelledby="trend-title">
          <h2 id="trend-title" className="text-xl font-semibold">
            {t("trend")}
          </h2>
          <p className="font-display text-2xl font-semibold">{t("current", { value: last.trendKg })}</p>
          <WeightChart
            points={overview.trend.slice(-CHART_DAYS)}
            targetKg={overview.targetWeightKg}
            label={t("chart")}
          />
          <p>{overview.weeklyChangeKg === null ? t("notEnough") : t("weekly", { value: overview.weeklyChangeKg })}</p>
          {overview.targetWeightKg !== null && overview.weeklyChangeKg !== null && (
            <p>
              {overview.projectedGoalDate
                ? t("projection", {
                    target: overview.targetWeightKg,
                    date: formatDay(overview.projectedGoalDate, locale, "long"),
                  })
                : t("noProjection", { target: overview.targetWeightKg })}
            </p>
          )}
          <p className="text-sm text-text-muted">{t("trendHint")}</p>
        </Card>
      )}

      <Card aria-labelledby="history-title">
        <h2 id="history-title" className="text-xl font-semibold">
          {t("history")}
        </h2>
        {history.length === 0 ? (
          <p className="text-text-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {history.map((entry) => (
              <li key={entry.date} className="flex items-center gap-2 py-1">
                <span className="flex-1 first-letter:uppercase">{formatDay(entry.date, locale)}</span>
                <span className="font-semibold">{entry.weightKg} kg</span>
                <DeleteWeightButton
                  date={entry.date}
                  label={t("delete", { date: formatDay(entry.date, locale, "short") })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link href="/body" className="font-semibold text-primary underline-offset-4 hover:underline">
        {t("bodyLink")}
      </Link>
      <Link href="/activity" className="font-semibold text-primary underline-offset-4 hover:underline">
        {t("activityLink")}
      </Link>
      <Link href="/metabolism" className="font-semibold text-primary underline-offset-4 hover:underline">
        {t("metabolismLink")}
      </Link>
    </>
  );
}
