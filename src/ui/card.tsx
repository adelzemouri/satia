import type { HTMLAttributes } from "react";

/**
 * `highlight` : carte de synthèse sur fond vert pâle (le bilan du jour du journal). Les pistes des
 * barres (`surface-muted`) y repassent en blanc pour rester visibles sur ce fond.
 */
export const cardTone = {
  default: "bg-surface",
  highlight: "bg-primary-soft [--color-surface-muted:var(--color-surface)]",
} as const;

export function Card({
  className = "",
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: keyof typeof cardTone }) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] p-5 ${cardTone[tone]} ${className}`}
      {...props}
    />
  );
}
