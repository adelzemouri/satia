import type { MacroSplit } from "@/domain/saved-meals";

const SEGMENTS = [
  ["protein", "stroke-protein"],
  ["carbs", "stroke-carbs"],
  ["fat", "stroke-fat"],
] as const;

/** Anneau d'un repas enregistré : une part par macro (selon les calories), les kcal au centre. */
export function MacroRing({ split, kcal, label }: { split: MacroSplit; kcal: number; label: string }) {
  const size = 80;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  // Petit jour entre deux parts, sauf quand une seule macro remplit tout l'anneau.
  const parts = SEGMENTS.filter(([key]) => split.percent[key] > 0);
  const gap = parts.length > 1 ? 1.5 : 0;
  const starts = parts.map((_, index) => parts.slice(0, index).reduce((total, [key]) => total + split.percent[key], 0));
  return (
    <span role="img" aria-label={label} className="relative flex size-20 shrink-0 items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        {parts.map(([key, color], index) => {
          const length = Math.max(0, split.percent[key] - gap);
          return (
            <circle
              key={key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-starts[index]!}
              className={color}
            />
          );
        })}
      </svg>
      <span className="relative flex flex-col items-center leading-none" aria-hidden="true">
        <span className="text-lg font-extrabold tabular-nums">{kcal}</span>
        <span className="text-xs text-text-muted">kcal</span>
      </span>
    </span>
  );
}
