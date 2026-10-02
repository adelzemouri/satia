/** Icônes au trait, dessinées pour l'app (24 × 24). Décoratives : le libellé porte le sens. */
export const ICONS = {
  home: "M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  journal: "M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1V4Zm0 13h12M9 8h6M9 11h4",
  plus: "M12 5v14M5 12h14",
  weight: "M5 8h14l-1.5 12h-11L5 8Zm4 0a3 3 0 0 1 6 0M12 12v3",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  admin: "M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4",
  logout: "M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 16l4-4-4-4M18 12H8",
  star: "m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z",
  left: "m15 5-7 7 7 7",
  right: "m9 5 7 7-7 7",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v5M14 11v5",
  copy: "M8 8h11v11H8zM5 16V5h11",
  drop: "M12 3.5c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.5Z",
  sprout: "M12 20v-8m0 0c0-4 3-6 7-6 0 4-3 6-7 6Zm0 0c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z",
} as const;

export function Icon({
  name,
  size = 22,
  filled = false,
}: {
  name: keyof typeof ICONS;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
