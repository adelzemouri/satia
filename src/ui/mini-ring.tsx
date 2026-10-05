import type { CSSProperties, ReactNode } from "react";

/**
 * Petit anneau de progression (jours de la semaine, repas). Purement décoratif : la valeur
 * est toujours donnée en texte à côté, ou par l'étiquette du lien qui l'entoure.
 */
export function MiniRing({
  percent,
  size = 44,
  stroke = 5,
  tone = "primary",
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  tone?: "primary" | "accent" | "muted";
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const color = tone === "accent" ? "stroke-accent" : tone === "muted" ? "stroke-text-muted" : "stroke-primary";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        {percent > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={offset}
            className={`ring-fill ${color}`}
            style={{ "--ring-length": length } as CSSProperties}
          />
        )}
      </svg>
      {children && <span className="relative">{children}</span>}
    </span>
  );
}
