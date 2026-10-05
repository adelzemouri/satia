/** Onglets principaux dans l'ordre de la barre du bas (le bouton d'ajout central n'en fait pas partie). */
export const SWIPE_TABS = ["/", "/journal", "/progress", "/profile"] as const;

/**
 * Onglet voisin pour un glissement : le doigt qui part vers la gauche amène l'onglet de droite,
 * comme on tourne une page. Seules les pages racines des onglets réagissent ; les pages
 * secondaires gardent leur bouton retour.
 */
export function adjacentTab(pathname: string, swipe: "left" | "right"): string | null {
  const index = (SWIPE_TABS as readonly string[]).indexOf(pathname);
  if (index === -1) return null;
  return SWIPE_TABS[swipe === "left" ? index + 1 : index - 1] ?? null;
}

/** Distance à parcourir pour changer d'onglet : un quart de l'écran, 80 px au moins. */
export function tabSwipeThreshold(width: number): number {
  return Math.max(80, Math.round(width * 0.25));
}
