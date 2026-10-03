import { getTranslations, setRequestLocale } from "next-intl/server";

import { FIBER_GOAL_G, FRUIT_VEG_GOAL_PORTIONS, SALT_REFERENCE_G } from "@/domain/quality";
import { toLocale } from "@/i18n/routing";
import { weekQualityReport } from "@/server/quality";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { EmptyState } from "@/ui/empty-state";

export default async function QualityPage({ params }: PageProps<"/[locale]/quality">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const report = await weekQualityReport(user.id);
  const t = await getTranslations("quality");
  const q = report.quality;
  const percent = (value: number) => Math.round(value * 100);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">
        {t("period", { from: formatDay(report.from, locale, "short"), to: formatDay(report.to, locale, "short") })}
      </p>

      {!q ? (
        <EmptyState scene="chart">{t("empty")}</EmptyState>
      ) : (
        <>
          <Card aria-labelledby="ideas-title">
            <h2 id="ideas-title" className="text-xl font-semibold">
              {t("ideasTitle")}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-6">
              {q.suggestions.map((suggestion) => (
                <li key={suggestion}>{t(`suggestions.${suggestion}`)}</li>
              ))}
            </ul>
          </Card>

          <Card aria-labelledby="averages-title">
            <h2 id="averages-title" className="text-xl font-semibold">
              {t("averagesTitle", { days: q.daysLogged })}
            </h2>
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  ["fiber", t("gramsPerDay", { value: q.fiberPerDay }), t("reference", { value: `${FIBER_GOAL_G} g` })],
                  [
                    "fruitVeg",
                    t("portionsPerDay", { value: q.fruitVegPortionsPerDay }),
                    t("reference", { value: t("portions", { count: FRUIT_VEG_GOAL_PORTIONS }) }),
                  ],
                  [
                    "salt",
                    t("gramsPerDay", { value: q.saltPerDay }),
                    t("reference", { value: `${SALT_REFERENCE_G} g` }),
                  ],
                  ["sugars", t("gramsPerDay", { value: q.sugarsPerDay }), null],
                ] as const
              ).map(([key, value, reference]) => (
                <div key={key} className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3">
                  <dt className="text-sm font-semibold text-text-muted">{t(key)}</dt>
                  <dd className="text-xl font-semibold">{value}</dd>
                  {reference && <dd className="text-xs text-text-muted">{reference}</dd>}
                </div>
              ))}
            </dl>
            <p className="text-sm text-text-muted">{t("averagesHint")}</p>
          </Card>

          <Card aria-labelledby="processing-title">
            <h2 id="processing-title" className="text-xl font-semibold">
              {t("processingTitle")}
            </h2>
            {q.ultraProcessedShare === null ? (
              <p>{t("novaUnknown")}</p>
            ) : (
              <>
                <p className="font-display text-3xl font-extrabold tracking-tight">
                  {percent(q.ultraProcessedShare)} %
                </p>
                <p>{t("ultraProcessed", { coverage: percent(q.novaCoverage) })}</p>
              </>
            )}
            <p className="text-sm text-text-muted">{t("novaHint")}</p>
            {q.topUltraProcessed.length > 0 && (
              <p>{t("topUltraProcessed", { names: q.topUltraProcessed.join(", ") })}</p>
            )}
            {q.topSalt.length > 0 && <p>{t("topSalt", { names: q.topSalt.join(", ") })}</p>}
          </Card>
        </>
      )}
      <p className="text-sm text-text-muted">{t("sources")}</p>
    </>
  );
}
