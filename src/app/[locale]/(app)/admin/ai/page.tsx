import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { AiSettingsForm } from "@/features/admin/ai-settings-form";
import { ConnectionTest } from "@/features/admin/connection-test";
import { formatUsd } from "@/features/admin/format-usd";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { llmConfig } from "@/llm/config";
import { aiStatus } from "@/llm/guard";
import { monthlyCosts } from "@/llm/usage";
import { requireAdmin } from "@/server/session";
import { getAiSettings } from "@/server/settings";
import { Card } from "@/ui/card";

export default async function AiAdminPage({ params }: PageProps<"/[locale]/admin/ai">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireAdmin(locale);
  const config = llmConfig();
  const [status, settings, costs] = await Promise.all([aiStatus(config), getAiSettings(), monthlyCosts()]);
  const t = await getTranslations("aiAdmin");
  const format = await getFormatter();

  const budgetMicros = status.budgetUsd * 1_000_000;
  const percent = budgetMicros > 0 ? Math.min(100, Math.round((status.spentUsdMicros / budgetMicros) * 100)) : 100;
  const pricesMissing = Object.values(config.prices).every((price) => price.input === 0 && price.output === 0);
  const state = !status.configured
    ? "notConfigured"
    : !status.enabled
      ? "disabled"
      : status.spentUsdMicros >= budgetMicros
        ? "budgetReached"
        : "active";
  const months = [...new Set(costs.map((row) => row.month))];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm font-semibold text-text-muted underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      </div>

      <Card aria-labelledby="ai-state">
        <h2 id="ai-state" className="text-xl font-semibold">
          {t("state")}
        </h2>
        <p className="font-semibold">{t(`states.${state}`)}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-text-muted">{t("provider")}</dt>
          <dd className="break-all">
            {status.configured
              ? [t(`providers.${config.provider}`), config.baseUrl && new URL(config.baseUrl).host]
                  .filter(Boolean)
                  .join(" · ")
              : "—"}
          </dd>
          <dt className="text-text-muted">{t("modelVision")}</dt>
          <dd className="break-all">{config.models.vision || "—"}</dd>
          <dt className="text-text-muted">{t("modelText")}</dt>
          <dd className="break-all">{config.models.text || "—"}</dd>
        </dl>
        {!status.configured && <p className="text-sm text-text-muted">{t("configureHint")}</p>}
        {status.configured && pricesMissing && <p className="text-sm text-text-muted">{t("pricesMissing")}</p>}
        <ConnectionTest disabled={!status.configured || !status.enabled} />
      </Card>

      <Card aria-labelledby="ai-budget">
        <h2 id="ai-budget" className="text-xl font-semibold">
          {t("budgetTitle")}
        </h2>
        <p>
          {t("spent", {
            spent: formatUsd(format, status.spentUsdMicros),
            budget: formatUsd(format, budgetMicros),
          })}
        </p>
        <div
          role="progressbar"
          aria-label={t("budgetTitle")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-3 overflow-hidden rounded-full bg-surface-muted"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <AiSettingsForm
          enabled={settings.enabled}
          budgetUsd={settings.monthlyBudgetUsd}
          defaultBudgetUsd={config.defaultMonthlyBudgetUsd}
        />
      </Card>

      <Card aria-labelledby="ai-costs">
        <h2 id="ai-costs" className="text-xl font-semibold">
          {t("costs")}
        </h2>
        {months.length === 0 ? (
          <p className="text-text-muted">{t("noCalls")}</p>
        ) : (
          months.map((month) => {
            const rows = costs.filter((row) => row.month === month);
            const total = rows.reduce((sum, row) => sum + row.costUsdMicros, 0);
            const label = format.dateTime(new Date(`${month}-15T12:00:00Z`), { month: "long", year: "numeric" });
            return (
              <div key={month} className="flex flex-col gap-1">
                <h3 className="font-semibold first-letter:uppercase">
                  {label} · {formatUsd(format, total)}
                </h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th scope="col" className="py-1 font-semibold">
                        {t("member")}
                      </th>
                      <th scope="col" className="py-1 pl-3 text-right font-semibold">
                        {t("calls")}
                      </th>
                      <th scope="col" className="py-1 pl-3 text-right font-semibold">
                        {t("tokens")}
                      </th>
                      <th scope="col" className="py-1 pl-3 text-right font-semibold">
                        {t("cost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.userId ?? "deleted"} className="border-b border-border last:border-0">
                        <th scope="row" className="py-1 font-normal">
                          {row.name ?? t("deletedMember")}
                        </th>
                        <td className="py-1 pl-3 text-right">
                          {row.calls}
                          {row.failures > 0 && ` (${t("failures", { count: row.failures })})`}
                        </td>
                        <td className="py-1 pl-3 text-right">{format.number(row.tokensIn + row.tokensOut)}</td>
                        <td className="py-1 pl-3 text-right">{formatUsd(format, row.costUsdMicros)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
        <p className="text-sm text-text-muted">{t("estimateNote")}</p>
      </Card>
    </>
  );
}
