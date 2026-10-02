import type { Muscle } from "@/domain/training/types";

/** Zone mise en valeur sur la silhouette, par groupe musculaire (coordonnées 0-64). */
const HIGHLIGHTS: Partial<Record<Muscle, string>> = {
  legs: "M25 40h5v18h-5zM34 40h5v18h-5z",
  glutes: "M24 34h16v8H24z",
  chest: "M24 17h16v8H24z",
  back: "M24 17h16v12H24z",
  shoulders: "M19 15h7v6h-7zM38 15h7v6h-7z",
  arms: "M15 18h6v16h-6zM43 18h6v16h-6z",
  core: "M26 25h12v10H26z",
};

/**
 * Pictogramme d'exercice dessiné pour l'app : une silhouette simple avec la zone travaillée
 * en couleur (cardio : cœur, mobilité : flèche circulaire). Décoratif, le texte porte le sens.
 */
export function ExerciseFigure({ muscle, size = 56 }: { muscle: Muscle; size?: number }) {
  const whole = muscle === "full_body";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0 rounded-2xl bg-primary-soft text-primary"
    >
      {HIGHLIGHTS[muscle] && <path d={HIGHLIGHTS[muscle]} fill="currentColor" opacity="0.35" />}
      <g fill="none" stroke="currentColor" strokeWidth={whole ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="10" r="5" />
        <path d="M24 17h16l-2 18H26zM24 17l-6 16M40 17l6 16M27 35l-1 23M37 35l1 23" />
        {muscle === "cardio" && <path d="M50 44c-3-3-7 0-4 4l4 4 4-4c3-4-1-7-4-4Z" />}
        {muscle === "mobility" && <path d="M10 44a22 22 0 0 0 44 0M54 44l-3-4M54 44l4-3" />}
      </g>
    </svg>
  );
}
