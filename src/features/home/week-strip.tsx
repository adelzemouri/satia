import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { formatDay, formatWeekday } from "@/ui/format-date";
import { MiniRing } from "@/ui/mini-ring";

/**
 * Bandeau des 7 derniers jours : un anneau par jour, rempli selon les calories saisies par
 * rapport à l'objectif. Chaque jour ouvre son journal.
 */
export async function WeekStrip({
  days,
  today,
  goalKcal,
  locale,
}: {
  days: { date: string; kcal: number }[];
  today: string;
  goalKcal: number | null;
  locale: string;
}) {
  const t = await getTranslations("home.week");
  return (
    <nav aria-label={t("label")}>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const future = day.date > today;
          const percent = goalKcal ? (day.kcal / goalKcal) * 100 : 0;
          const over = goalKcal !== null && day.kcal > goalKcal;
          const number = Number(day.date.slice(8));
          const content = (
            <>
              <span className="text-xs font-semibold text-text-muted first-letter:uppercase" aria-hidden="true">
                {formatWeekday(day.date, locale).slice(0, 3).replace(".", "")}
              </span>
              <MiniRing percent={percent} size={38} stroke={4} tone={over ? "muted" : "primary"}>
                <span
                  className={`text-sm ${
                    day.date === today ? "font-extrabold text-primary" : future ? "text-text-muted" : "font-semibold"
                  }`}
                >
                  {number}
                </span>
              </MiniRing>
            </>
          );
          const label = t("day", { day: formatDay(day.date, locale), kcal: day.kcal });
          return (
            <li key={day.date} className="flex justify-center">
              {future ? (
                <span className="flex flex-col items-center gap-1 py-1" aria-label={formatDay(day.date, locale)}>
                  {content}
                </span>
              ) : (
                <Link
                  href={day.date === today ? "/journal" : { pathname: "/journal", query: { date: day.date } }}
                  aria-label={label}
                  aria-current={day.date === today ? "date" : undefined}
                  className={`flex min-h-12 w-full flex-col items-center gap-1 rounded-2xl py-1 ${
                    day.date === today ? "bg-primary-soft" : ""
                  }`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
