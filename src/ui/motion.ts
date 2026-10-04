/** Petits outils d'animation partagés : courbe, vibration, gestes de glissement. */

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

/** Distance minimale (px) d'un glissement qui déclenche son action. */
export const SWIPE_THRESHOLD = 110;

/** Seuil pour une ligne donnée : au moins 40 % de sa largeur, pour éviter les déclenchements involontaires. */
export function swipeThreshold(width: number): number {
  return Math.max(SWIPE_THRESHOLD, Math.round(width * 0.4));
}

/** Action d'un glissement terminé : vers la gauche, vers la droite, ou retour en place. */
export function swipeOutcome(dx: number, threshold = SWIPE_THRESHOLD): "left" | "right" | null {
  if (dx <= -threshold) return "left";
  if (dx >= threshold) return "right";
  return null;
}

/**
 * Le geste est-il horizontal ? Décidé une fois le doigt déplacé d'une dizaine de pixels ; il doit
 * être nettement plus horizontal que vertical, sinon c'est un défilement de la page.
 */
export function swipeAxis(dx: number, dy: number, slop = 10): "x" | "y" | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) * 2 ? "x" : "y";
}

/** Bord gauche de l'écran réservé au geste « retour » du téléphone. */
export const EDGE_GUARD = 24;
