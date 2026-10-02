const WIDTH = 320;
const HEIGHT = 160;
const PAD = 10;

type Point = { weekStart: string; estimatedTdee: number; measuredTdee: number | null };

/**
 * Dépense estimée par la formule (pointillés) et dépense mesurée (trait plein), semaine
 * après semaine ; les chiffres sont repris en texte sur la page.
 */
export function TdeeChart({ points, label }: { points: Point[]; label: string }) {
  if (points.filter((point) => point.measuredTdee !== null).length < 2) return null;
  const values = points.flatMap((point) => [
    point.estimatedTdee,
    ...(point.measuredTdee === null ? [] : [point.measuredTdee]),
  ]);
  const min = Math.min(...values) - 50;
  const max = Math.max(...values) + 50;
  const x = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (WIDTH - 2 * PAD);
  const y = (kcal: number) => PAD + ((max - kcal) / (max - min)) * (HEIGHT - 2 * PAD);
  const path = (pick: (point: Point) => number | null) =>
    points
      .flatMap((point, i) => {
        const value = pick(point);
        return value === null ? [] : [`${x(i).toFixed(1)},${y(value).toFixed(1)}`];
      })
      .map((coords, i) => `${i === 0 ? "M" : "L"}${coords}`)
      .join("");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full">
      <path
        d={path((point) => point.estimatedTdee)}
        fill="none"
        strokeWidth="2"
        strokeDasharray="5 5"
        className="stroke-text-muted"
      />
      <path
        d={path((point) => point.measuredTdee)}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-primary"
      />
    </svg>
  );
}
