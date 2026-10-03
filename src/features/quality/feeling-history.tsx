import { useFormatter, useTranslations } from "next-intl";

import { type FeelingDay, feelingAverage, FEELINGS_QUESTIONS, type FeelingQuestion } from "@/domain/feelings";

const WIDTH = 300;
const PAD = 5;

function xAt(index: number, count: number): number {
  return PAD + (index * (WIDTH - PAD * 2)) / Math.max(1, count - 1);
}

/** Courbe d'une question notée de 1 à 5 : points reliés, interrompue les jours non notés. */
function ScaleChart({
  days,
  question,
  label,
  pointLabel,
}: {
  days: readonly FeelingDay[];
  question: FeelingQuestion;
  label: string;
  pointLabel: (day: FeelingDay, value: number) => string;
}) {
  const height = 52;
  const y = (value: number) => height - 6 - ((value - 1) / 4) * (height - 12);
  const segments: string[] = [];
  let current = "";
  days.forEach((day, index) => {
    const value = day[question];
    if (value === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${xAt(index, days.length).toFixed(1)} ${y(value).toFixed(1)}`;
  });
  if (current) segments.push(current);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto w-full text-primary" role="img" aria-label={label}>
      {[1, 3, 5].map((value) => (
        <line
          key={value}
          x1={0}
          x2={WIDTH}
          y1={y(value)}
          y2={y(value)}
          className="stroke-border"
          strokeDasharray={value === 3 ? "2 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {segments.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {days.map((day, index) => {
        const value = day[question];
        if (value === null) return null;
        return (
          <g key={day.date}>
            {/* Cible de survol plus large que le point. */}
            <circle cx={xAt(index, days.length)} cy={y(value)} r={6} fill="transparent">
              <title>{pointLabel(day, value)}</title>
            </circle>
            <circle
              cx={xAt(index, days.length)}
              cy={y(value)}
              r={3.6}
              fill="currentColor"
              className="stroke-surface"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Barres des calories saisies chaque jour (aucune barre les jours sans saisie). */
function KcalChart({
  days,
  label,
  barLabel,
}: {
  days: readonly FeelingDay[];
  label: string;
  barLabel: (day: FeelingDay) => string;
}) {
  const height = 56;
  const max = Math.max(1, ...days.map((day) => day.kcal ?? 0)) * 1.08;
  const step = (WIDTH - PAD * 2) / Math.max(1, days.length - 1);
  const barWidth = Math.max(2, step * 0.62);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto w-full text-primary" role="img" aria-label={label}>
      <line
        x1={0}
        x2={WIDTH}
        y1={height - 0.5}
        y2={height - 0.5}
        className="stroke-border"
        vectorEffect="non-scaling-stroke"
      />
      {days.map((day, index) => {
        if (!day.kcal) return null;
        const barHeight = Math.max(3, (day.kcal / max) * (height - 4));
        return (
          <rect
            key={day.date}
            x={xAt(index, days.length) - barWidth / 2}
            y={height - 1 - barHeight}
            width={barWidth}
            height={barHeight}
            rx={Math.min(2, barWidth / 2)}
            fill="currentColor"
            opacity={0.75}
          >
            <title>{barLabel(day)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/**
 * Historique du ressenti sur quelques semaines : une petite courbe par question (même échelle
 * de 1 à 5) et, à part, les calories du jour. Un tableau reprend les mêmes valeurs.
 */
export function FeelingHistory({ days }: { days: readonly FeelingDay[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const dayLabel = (date: string) => format.dateTime(new Date(`${date}T12:00:00`), { day: "numeric", month: "short" });
  const logged = days.filter((day) => day.hunger !== null || day.energy !== null || day.mood !== null);
  if (logged.length < 2) return <p className="text-text-muted">{t("progress.history.empty")}</p>;
  const withKcal = days.filter((day) => day.kcal !== null);
  const kcalAverage =
    withKcal.length > 0 ? Math.round(withKcal.reduce((sum, day) => sum + day.kcal!, 0) / withKcal.length) : null;
  const pointLabel = (day: FeelingDay, value: number) =>
    t("progress.history.point", { date: dayLabel(day.date), value });
  const first = days[0]!;
  const middle = days[Math.floor(days.length / 2)]!;

  return (
    <div className="flex flex-col gap-4">
      {FEELINGS_QUESTIONS.map((question) => {
        const average = feelingAverage(days, question);
        return (
          <div key={question} className="flex flex-col gap-1">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{t(`checkin.${question}.label`)}</span>
              {average !== null && (
                <span className="text-sm text-text-muted">{t("progress.history.average", { value: average })}</span>
              )}
            </p>
            <ScaleChart
              days={days}
              question={question}
              label={t(`checkin.${question}.label`)}
              pointLabel={pointLabel}
            />
          </div>
        );
      })}
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{t("progress.history.kcal")}</span>
          {kcalAverage !== null && (
            <span className="text-sm text-text-muted">{t("progress.history.kcalAverage", { value: kcalAverage })}</span>
          )}
        </p>
        <KcalChart
          days={days}
          label={t("progress.history.kcal")}
          barLabel={(day) => t("progress.history.bar", { date: dayLabel(day.date), value: day.kcal! })}
        />
        <p className="flex justify-between text-xs text-text-muted" aria-hidden>
          <span>{dayLabel(first.date)}</span>
          <span>{dayLabel(middle.date)}</span>
          <span>{t("progress.history.today")}</span>
        </p>
      </div>
      <details className="rounded-2xl bg-surface-muted px-4 py-3">
        <summary className="cursor-pointer font-semibold text-primary">{t("progress.history.table")}</summary>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th scope="col" className="py-1 font-semibold">
                {t("progress.history.day")}
              </th>
              {FEELINGS_QUESTIONS.map((question) => (
                <th key={question} scope="col" className="py-1 text-right font-semibold">
                  {t(`checkin.${question}.label`)}
                </th>
              ))}
              <th scope="col" className="py-1 text-right font-semibold">
                {t("progress.history.kcal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...days]
              .reverse()
              .filter((day) => day.kcal !== null || logged.includes(day))
              .map((day) => (
                <tr key={day.date} className="border-b border-border last:border-0">
                  <th scope="row" className="py-1 font-normal">
                    {dayLabel(day.date)}
                  </th>
                  {FEELINGS_QUESTIONS.map((question) => (
                    <td key={question} className="py-1 text-right">
                      {day[question] ?? <span className="text-text-muted">{t("progress.history.none")}</span>}
                    </td>
                  ))}
                  <td className="py-1 text-right">{day.kcal === null ? "" : format.number(day.kcal)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
