import type { ReactNode } from "react";

/**
 * Petites scènes au trait pour les écrans encore vides, dessinées pour l'app (96 × 72). Un disque
 * pastel derrière, le dessin à la couleur principale : lisibles en thème clair comme sombre.
 */
const SCENES = {
  plate: (
    <>
      <circle cx="48" cy="40" r="20" />
      <circle cx="48" cy="40" r="13" />
      <path d="M18 24v10a4 4 0 0 0 4 4v18M22 24v10M26 24v10a4 4 0 0 1-4 4M76 24c-4 3-5 8-5 14h5v18" />
    </>
  ),
  scale: (
    <>
      <rect x="24" y="22" width="48" height="38" rx="9" />
      <path d="M36 34a12 12 0 0 1 24 0Z" />
      <path d="m48 34 5-6" />
    </>
  ),
  tape: (
    <>
      <circle cx="38" cy="38" r="16" />
      <circle cx="38" cy="38" r="5" />
      <path d="M38 54h40v-8M50 54v-4M58 54v-6M66 54v-4" />
    </>
  ),
  shoe: (
    <>
      <path d="M20 50c0-10 4-22 10-24 3 4 9 6 14 4l6 10c8 2 20 3 26 6 2 2 2 6-1 6H23a3 3 0 0 1-3-2Z" />
      <path d="M44 34l-5 4M48 40l-5 4M20 52h58" />
    </>
  ),
  timer: (
    <>
      <circle cx="48" cy="40" r="20" />
      <path d="M48 40V28M42 14h12M48 14v6M64 22l4-4" />
    </>
  ),
  pill: (
    <>
      <rect x="24" y="30" width="48" height="20" rx="10" transform="rotate(-25 48 40)" />
      <path d="m44 28 8 22" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M22 30v20M30 24v32M66 24v32M74 30v20M30 40h36" />
    </>
  ),
  basket: (
    <>
      <path d="M18 34h60l-6 24H24Z" />
      <path d="m32 34 8-14M64 34l-8-14M36 42v8M48 42v8M60 42v8" />
    </>
  ),
  chat: (
    <>
      <path d="M18 18h40v24H32l-10 8v-8h-4Z" />
      <path d="M44 34h34v22h-4v8l-10-8H44Z" />
      <path d="M28 28h20M54 44h16" />
    </>
  ),
  jar: (
    <>
      <path d="M34 22h28v6l4 6v22a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V34l4-6Z" />
      <path d="M34 28h28M38 44h20" />
    </>
  ),
  chart: (
    <>
      <path d="M20 58h56M26 50l12-10 10 6 16-16 8 6" />
      <circle cx="38" cy="40" r="2.5" />
      <circle cx="64" cy="30" r="2.5" />
    </>
  ),
} as const;

export type EmptyScene = keyof typeof SCENES;

/** État vide d'une liste : une scène, une phrase et, si utile, un bouton pour démarrer. */
export function EmptyState({
  scene,
  children,
  action,
}: {
  scene: EmptyScene;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 96 72"
        width={96}
        height={72}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      >
        <ellipse cx="48" cy="40" rx="40" ry="30" className="fill-primary-soft" stroke="none" />
        {SCENES[scene]}
      </svg>
      <p className="max-w-xs text-text-muted">{children}</p>
      {action}
    </div>
  );
}
