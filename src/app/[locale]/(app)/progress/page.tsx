import { getTranslations, setRequestLocale } from "next-intl/server";

import { HubLinks } from "@/features/navigation/hub-links";
import { WeightChart } from "@/features/weight/weight-chart";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { weightOverview } from "@/server/journal";
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
  const overview = await weightOverview(user.id);
  const trend = overview.trend.at(-1);
  const lastWeighIn = overview.entries.at(-1)?.date ?? null;
  const t = await getTranslations();

  return (
    // Sur ordinateur, les cartes se rangent sur deux colonnes.
    <div data-wide className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <h1 className="font-display text-3xl font-extrabold tracking-tight lg:col-span-2">{t("progress.title")}</h1>

      <Card aria-labelledby="weight-title">
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
  );
}
