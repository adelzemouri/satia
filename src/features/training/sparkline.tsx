/** Petite courbe de progression d'un repère (décorative : la valeur est écrite à côté). */
export function Sparkline({ points, width = 96, height = 22 }: { points: number[]; width?: number; height?: number }) {
  const low = Math.min(...points);
  const span = Math.max(...points) - low || 1;
  const coords = points.map((value, index) => [
    3 + (index * (width - 6)) / Math.max(1, points.length - 1),
    height - 3 - ((value - low) / span) * (height - 6),
  ]);
  const last = coords[coords.length - 1]!;
  return (
    <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <polyline
        points={coords.map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(" ")}
        fill="none"
        className="stroke-primary"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} className="fill-pomme" />
    </svg>
  );
}
