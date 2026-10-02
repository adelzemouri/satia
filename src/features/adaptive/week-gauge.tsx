import { getTranslations } from "next-intl/server";

/** Jauge de la semaine en budget hebdomadaire : consommé / total. */
export async function WeekGauge({ consumed, total }: { consumed: number; total: number }) {
  const t = await getTranslations("week");
  const percent = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex justify-between gap-2 text-sm font-semibold">
        <span>{t("gauge")}</span>
        <span>{t("gaugeValue", { consumed, total })}</span>
      </p>
      <div
        role="progressbar"
        aria-label={t("gauge")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(consumed, total)}
        aria-valuetext={t("gaugeValue", { consumed, total })}
        className="h-3 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
