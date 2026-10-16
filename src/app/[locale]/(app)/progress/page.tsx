import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { StepsChart } from "@/features/activity/steps-chart";
import { HubLinks } from "@/features/navigation/hub-links";
import { WeightChart } from "@/features/weight/weight-chart";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { activityOverview } from "@/server/activity";
import { metabolismOverview } from "@/server/adaptive";
import { weightOverview } from "@/server/journal";
import { trainingHistory } from "@/server/training";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { PrivateBlock } from "@/ui/private";

/** Courbe de l'onglet : les deux derniers mois suffisent à voir la tendance. */
const CHART_DAYS = 60;

/** Onglet « Progrès » : la donnée d'abord (poids et tendance), puis le reste du suivi. */
export default async function ProgressPage({ params }: PageProps<"/[locale]/progress">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  // Les cartes du tableau de bord (ordinateur) lisent aussi métabolisme, pas et séances.
  const [overview, metabolism, activity, sessions] = await Promise.all([
    weightOverview(user.id),
    metabolismOverview(user.id),
    activityOverview(user.id, today),
    trainingHistory(user.id, 28),
  ]);
  const trend = overview.trend.at(-1);
  const lastWeighIn = overview.entries.at(-1)?.date ?? null;
  const t = await getTranslations();
  const lastSession = sessions[0];
  const linkClass = "self-start font-semibold text-primary underline-offset-4 hover:underline";

  return (
    // Sur ordinateur, un tableau de bord : poids, dépense réelle, séances et pas, les rubriques à droite.
    <div data-wide className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
      <h1 className="font-display text-3xl font-extrabold tracking-tight lg:col-span-3">{t("progress.title")}</h1>

      <Card aria-labelledby="weight-title" className="lg:col-span-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="weight-title" className="text-xl font-bold">
            {t("weight.title")}
          </h2>
          <Link
            href="/weight"
            className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("progress.weightOpen")}
          </Link>
        </div>
        {trend ? (
          <PrivateBlock className="flex flex-col gap-3">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-display text-3xl font-extrabold tracking-tight">
                {t("progress.weightValue", { value: trend.trendKg })}
              </span>
              <span className="text-text-muted">
                {overview.weeklyChangeKg === null
                  ? t("weight.notEnough")
                  : t("weight.weekly", { value: overview.weeklyChangeKg })}
              </span>
            </p>
            <WeightChart
              points={overview.trend.slice(-CHART_DAYS)}
              targetKg={overview.targetWeightKg}
              label={t("weight.chart")}
            />
          </PrivateBlock>
        ) : (
          <>
            <p className="text-text-muted">{t("progress.weightEmpty")}</p>
            <Link href="/weight" className={buttonClass("secondary")}>
              {t("weight.add")}
            </Link>
          </>
        )}
      </Card>

      <div className="lg:col-start-3 lg:row-span-3 lg:row-start-2">
        <HubLinks
          label={t("home.more")}
          links={[
            {
              href: "/weight",
              icon: "weight",
              label: t("weight.title"),
              hint:
                lastWeighIn === null
                  ? undefined
                  : t("progress.lastWeighIn", { date: formatDay(lastWeighIn, locale, "short") }),
            },
            { href: "/training", icon: "dumbbell", label: t("nav.training") },
            { href: "/activity", icon: "run", label: t("activity.title") },
            { href: "/body", icon: "ruler", label: t("body.title") },
            { href: "/quality", icon: "sprout", label: t("quality.title") },
            { href: "/metabolism", icon: "pulse", label: t("metabolism.title") },
          ]}
        />
      </div>

      {metabolism && (
        <Card aria-labelledby="tdee-title" className="max-lg:hidden">
          <h2 id="tdee-title" className="text-xl font-bold">
            {t("metabolism.expenditure")}
          </h2>
          {metabolism.measurement.status === "measured" ? (
            <p className="font-display text-3xl font-extrabold tracking-tight">
              {t("metabolism.kcalPerDay", { value: metabolism.measurement.tdee })}
            </p>
          ) : (
            <p className="text-text-muted">{t("progress.tdeeNone")}</p>
          )}
          <p className="text-sm text-text-muted">{t("progress.goal", { kcal: metabolism.goalKcal })}</p>
          <Link href="/metabolism" className={linkClass}>
            {t("metabolism.title")}
          </Link>
        </Card>
      )}

      <Card aria-labelledby="sessions-title" className="max-lg:hidden">
        <h2 id="sessions-title" className="text-xl font-bold">
          {t("nav.training")}
        </h2>
        {lastSession ? (
          <>
            <p className="font-display text-2xl font-extrabold tracking-tight first-letter:uppercase">
              {t("progress.lastSession", { date: formatDay(lastSession.date, locale) })}
            </p>
            <p className="text-sm text-text-muted">{t("progress.sessions", { count: sessions.length })}</p>
          </>
        ) : (
          <p className="text-text-muted">{t("progress.noSession")}</p>
        )}
        <Link href="/training" className={linkClass}>
          {t("nav.training")}
        </Link>
      </Card>

      <Card aria-labelledby="steps-chart-title" className="max-lg:hidden lg:col-span-2">
        <h2 id="steps-chart-title" className="text-xl font-bold">
          {t("activity.steps.chartTitle")}
        </h2>
        <StepsChart steps={activity.steps} today={today} locale={locale} />
        <Link href="/activity" className={linkClass}>
          {t("activity.title")}
        </Link>
      </Card>
    </div>
  );
}
