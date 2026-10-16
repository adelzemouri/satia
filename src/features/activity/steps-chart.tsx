import { useTranslations } from "next-intl";

import { addDays } from "@/domain/energy";
import { formatDay, formatWeekday } from "@/ui/format-date";

/**
 * Pas des 14 derniers jours en barres (ordinateur) : une barre par jour, aujourd'hui à droite,
 * les jours sans saisie restent vides. Le nombre exact se lit au survol et par les lecteurs d'écran.
 */
export function StepsChart({
  steps,
  today,
  locale,
}: {
  steps: readonly { date: string; steps: number }[];
  today: string;
  locale: string;
}) {
  const t = useTranslations("activity.steps");
  const byDate = new Map(steps.map((row) => [row.date, row.steps]));
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index - 13));
  const max = Math.max(1, ...steps.map((row) => row.steps));
  const logged = steps.filter((row) => row.steps > 0);
  const average =
    logged.length === 0 ? null : Math.round(logged.reduce((sum, row) => sum + row.steps, 0) / logged.length);

  return (
    <div className="flex flex-col gap-2">
      {average !== null && <p className="text-sm text-text-muted">{t("average", { steps: average })}</p>}
      <ol className="flex h-36 items-end gap-1.5">
        {days.map((date) => {
          const value = byDate.get(date) ?? null;
          const label = `${formatDay(date, locale, "short")} : ${value === null ? t("none") : t("value", { steps: value })}`;
          return (
            <li key={date} title={label} className="flex h-full flex-1 flex-col justify-end">
              <span className="sr-only">{label}</span>
              <span
                aria-hidden="true"
                className={`block rounded-t-md ${value === null ? "h-1 bg-border" : date === today ? "bg-pomme" : "bg-primary"}`}
                style={value === null ? undefined : { height: `${Math.max(2, (value / max) * 100)}%` }}
              />
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="flex gap-1.5 text-center text-xs text-text-muted">
        {days.map((date) => (
          <span key={date} className="flex-1 first-letter:uppercase">
            {formatWeekday(date, locale).slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}
