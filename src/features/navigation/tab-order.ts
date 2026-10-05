/**
 * Onglets principaux dans l'ordre de la barre du bas (le bouton d'ajout central n'en fait pas
 * partie), avec les pages racines qui comptent pour chacun : les trois pages de la Cuisine.
 */
export const SWIPE_TABS = [
  { href: "/", roots: ["/"] },
  { href: "/recipes", roots: ["/recipes", "/plan", "/meals"] },
  { href: "/progress", roots: ["/progress"] },
  { href: "/profile", roots: ["/profile"] },
] as const;

/**
 * Onglet voisin pour un glissement : le doigt qui part vers la gauche amène l'onglet de droite,
 * comme on tourne une page. Seules les pages racines des onglets réagissent ; les pages
 * secondaires gardent leur bouton retour.
 */
export function adjacentTab(pathname: string, swipe: "left" | "right"): string | null {
  const index = SWIPE_TABS.findIndex((tab) => (tab.roots as readonly string[]).includes(pathname));
  if (index === -1) return null;
  return SWIPE_TABS[swipe === "left" ? index + 1 : index - 1]?.href ?? null;
}

/** Distance à parcourir pour changer d'onglet : un quart de l'écran, 80 px au moins. */
export function tabSwipeThreshold(width: number): number {
  return Math.max(80, Math.round(width * 0.25));
}
