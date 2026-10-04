/** Types de transition passés aux liens (`transitionTypes`), lus par le gabarit des pages. */
export const NAV_FORWARD = ["nav-forward"];
export const NAV_BACK = ["nav-back"];

/** Sens du glissement entre deux onglets : vers la droite de la barre, on avance. */
export function tabDirection(fromIndex: number, toIndex: number): string[] | undefined {
  if (fromIndex < 0 || toIndex < 0) return undefined;
  if (toIndex > fromIndex) return NAV_FORWARD;
  // Même onglet depuis une page secondaire (le poids vers « Progrès ») : on remonte.
  return NAV_BACK;
}
