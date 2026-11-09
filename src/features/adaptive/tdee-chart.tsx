const WIDTH = 320;
const HEIGHT = 160;
const LEFT = 38;
const RIGHT = 12;
const TOP = 10;
const BOTTOM = 26;

export type ChartPoint = { label: string; goal: number; measured: number };

/** Pas des repères de l'axe : 100, 200 ou 500 kcal selon l'amplitude. */
function tickStep(range: number): number {
  if (range <= 400) return 100;
  if (range <= 900) return 200;
  return 500;
}

/**
 * Objectif (vert) et dépense mesurée (rouge pomme), semaine après semaine, avec des repères
 * en kcal et les dates. L'écart entre les deux courbes est teinté : c'est la marge visée.
 * Les chiffres sont repris en texte dans la liste sous le graphique.
 */
export function TdeeChart({
  points,
  label,
  legend,
  locale,
}: {
  points: ChartPoint[];
  label: string;
  legend: { goal: string; measured: string };
  locale: string;
}) {
  if (points.length < 2) return null;
  const values = points.flatMap((point) => [point.goal, point.measured]);
  const step = tickStep(Math.max(...values) - Math.min(...values));
  const min = Math.floor((Math.min(...values) - 30) / step) * step;
  const max = Math.ceil((Math.max(...values) + 30) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step);
  const x = (index: number) => LEFT + 8 + (index / (points.length - 1)) * (WIDTH - LEFT - RIGHT - 16);
  const y = (kcal: number) => TOP + ((max - kcal) / (max - min)) * (HEIGHT - TOP - BOTTOM);
  const line = (pick: (point: ChartPoint) => number) =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`)
      .join("");
  const band = `${line((point) => point.goal)}${[...points]
    .reverse()
    .map((point, index) => `L${x(points.length - 1 - index).toFixed(1)},${y(point.measured).toFixed(1)}`)
    .join("")}Z`;
  const number = new Intl.NumberFormat(locale);
  // Au-delà de 6 semaines, une date sur deux pour qu'elles ne se chevauchent pas.
  const every = points.length > 6 ? 2 : 1;
  const last = points.length - 1;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-primary" />
          {legend.goal}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-pomme" />
          {legend.measured}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} strokeWidth="1" className="stroke-border" />
            <text x={LEFT - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="10" className="fill-text-muted">
              {number.format(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          (last - index) % every === 0 ? (
            <text
              key={point.label}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"}
              fontSize="10"
              className="fill-text-muted"
            >
              {point.label}
            </text>
          ) : null,
        )}
        <path d={band} className="fill-primary-soft" opacity="0.8" />
        <path
          d={line((point) => point.goal)}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        <path
          d={line((point) => point.measured)}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-pomme"
        />
        <circle
          cx={x(last)}
          cy={y(points[last]!.goal)}
          r="3.5"
          strokeWidth="2"
          className="fill-surface stroke-primary"
        />
        <circle
          cx={x(last)}
          cy={y(points[last]!.measured)}
          r="3.5"
          strokeWidth="2"
          className="fill-surface stroke-pomme"
        />
      </svg>
    </figure>
  );
}
