import type { TrendPoint } from "@/domain/weight-trend";

const WIDTH = 320;
const HEIGHT = 160;
const PAD = 8;

/** Courbe de tendance (trait) et pesées (points) ; le texte de la page porte les chiffres. */
export function WeightChart({
  points,
  targetKg,
  label,
}: {
  points: TrendPoint[];
  targetKg: number | null;
  label: string;
}) {
  if (points.length < 2) return null;
  const values = points.flatMap((point) => [point.trendKg, ...(point.weightKg === null ? [] : [point.weightKg])]);
  if (targetKg !== null) values.push(targetKg);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (WIDTH - 2 * PAD);
  const y = (kg: number) => PAD + ((max - kg) / (max - min)) * (HEIGHT - 2 * PAD);
  const trendPath = points
    .map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(point.trendKg).toFixed(1)}`)
    .join("");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full">
      {targetKg !== null && (
        <line
          x1={PAD}
          x2={WIDTH - PAD}
          y1={y(targetKg)}
          y2={y(targetKg)}
          strokeDasharray="4 4"
          strokeWidth="1"
          className="stroke-text-muted"
        />
      )}
      {points.map((point, i) =>
        point.weightKg === null ? null : (
          <circle key={point.date} cx={x(i)} cy={y(point.weightKg)} r="2.5" className="fill-fat/60" />
        ),
      )}
      <path d={trendPath} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-primary" />
    </svg>
  );
}
