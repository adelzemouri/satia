/** Petits outils d'animation partagés : courbe, mémoire de la dernière valeur, vibration. */

/** Décélération douce : rapide au début, lente à l'arrivée. */
export function easeOutCubic(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) ** 3;
}

/** Valeur intermédiaire entre `from` et `to`, arrondie à l'entier. */
export function tween(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * easeOutCubic(progress));
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const PREFIX = "pommelia:motion:";

/** Dernière valeur affichée pour une clé (sur l'onglet en cours), puis mémorise la nouvelle. */
export function swapRemembered(key: string, value: number): number | null {
  try {
    const stored = sessionStorage.getItem(PREFIX + key);
    sessionStorage.setItem(PREFIX + key, String(value));
    const previous = stored === null ? null : Number(stored);
    return previous !== null && Number.isFinite(previous) ? previous : null;
  } catch {
    return null;
  }
}

/**
 * Courte vibration de confirmation (Android ; iPhone n'en propose pas aux applis web). Rien quand
 * l'utilisateur a demandé moins d'animations.
 */
export function haptic(pattern: number | number[] = 12): void {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration refusée (iframe, réglage du navigateur) : sans conséquence.
  }
}

/** Distance (px) à partir de laquelle un glissement horizontal déclenche son action. */
export const SWIPE_THRESHOLD = 88;

/** Action d'un glissement terminé : vers la gauche, vers la droite, ou retour en place. */
export function swipeOutcome(dx: number, threshold = SWIPE_THRESHOLD): "left" | "right" | null {
  if (dx <= -threshold) return "left";
  if (dx >= threshold) return "right";
  return null;
}

/** Le geste est-il horizontal ? Décidé une fois le doigt déplacé de quelques pixels. */
export function swipeAxis(dx: number, dy: number, slop = 8): "x" | "y" | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
}
