/** Petits outils d'animation partagés : courbe, vibration, gestes de glissement. */

/**
 * Courbe « ease-out-strong » des animations CSS (cubic-bezier(0.23, 1, 0.32, 1)), calculée en JS
 * pour que les nombres qui défilent suivent exactement l'anneau : très rapide au début, puis un
 * long ralenti où les dernières unités défilent une à une.
 */
export function easeOutStrong(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  if (p === 0 || p === 1) return p;
  return bezierY(bezierT(p));
}

const X1 = 0.23;
const Y1 = 1;
const X2 = 0.32;
const Y2 = 1;

function bezierX(t: number): number {
  return 3 * X1 * t * (1 - t) ** 2 + 3 * X2 * t ** 2 * (1 - t) + t ** 3;
}

function bezierY(t: number): number {
  return 3 * Y1 * t * (1 - t) ** 2 + 3 * Y2 * t ** 2 * (1 - t) + t ** 3;
}

/** Retrouve le paramètre t dont l'abscisse vaut x (dichotomie : x croît avec t). */
function bezierT(x: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (bezierX(middle) < x) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Valeur intermédiaire entre `from` et `to`, arrondie à l'entier. */
export function tween(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * easeOutStrong(progress));
}

/** Dernières unités d'un compteur, affichées une à une avec un écart qui s'allonge. */
const SETTLE_UNITS = 10;
const SETTLE_FIRST_MS = 40;
const SETTLE_GROWTH = 1.22;

/** Instants (ms, depuis le début de la fin au ralenti) où chacune des dernières unités apparaît. */
const SETTLE_TICKS = Array.from({ length: SETTLE_UNITS }, (_, index) => index).reduce<number[]>(
  (ticks, index) => [...ticks, (ticks.at(-1) ?? 0) + SETTLE_FIRST_MS * SETTLE_GROWTH ** index],
  [],
);

/**
 * Défilement d'un compteur en deux temps : il file jusqu'à quelques unités de l'arrivée (`fastMs`,
 * courbe de l'anneau), puis égrène les dernières une à une, de plus en plus lentement. Renvoie la
 * valeur à afficher à l'instant `elapsed` et la durée totale.
 */
export function countUp(from: number, to: number, fastMs: number) {
  const direction = Math.sign(to - from);
  const settle = Math.min(SETTLE_UNITS, Math.abs(to - from));
  const settleFrom = to - direction * settle;
  const fast = settleFrom === from ? 0 : fastMs;
  const duration = fast + (settle === 0 ? 0 : SETTLE_TICKS[settle - 1]!);
  const valueAt = (elapsed: number): number => {
    if (elapsed < fast) return tween(from, settleFrom, elapsed / fast);
    const done = SETTLE_TICKS.slice(0, settle).filter((tick) => tick <= elapsed - fast).length;
    return settleFrom + direction * done;
  };
  return { duration, valueAt };
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

/**
 * Dernière valeur affichée par un compteur ou un anneau depuis l'ouverture de l'app (navigateur
 * seulement : côté serveur, rien n'est partagé entre les requêtes). Revenir sur l'accueil reprend
 * de là au lieu de tout rejouer depuis zéro ; seul l'écart avec la nouvelle valeur s'anime.
 */
const shownValues = new Map<string, number>();

export function lastShown(key: string): number | undefined {
  return typeof window === "undefined" ? undefined : shownValues.get(key);
}

export function rememberShown(key: string, value: number): void {
  shownValues.set(key, value);
}

/** Le remplissage des anneaux et jauges à l'ouverture de l'app est-il déjà passé ? */
export function fillsDone(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-fills-done");
}

/** Vitesse minimale (px/ms) d'un geste vif qui déclenche l'action sans atteindre le seuil. */
export const FLICK_VELOCITY = 0.11;

/** Distance minimale (px) d'un geste vif, pour qu'un tremblement du doigt ne compte pas. */
export const FLICK_MIN_DISTANCE = 32;

/**
 * Action d'un glissement terminé, en tenant compte de la vitesse : un petit geste rapide suffit,
 * comme sur les listes des applis natives ; un geste lent doit toujours atteindre le seuil.
 */
export function swipeRelease(dx: number, elapsedMs: number, threshold = SWIPE_THRESHOLD): "left" | "right" | null {
  const outcome = swipeOutcome(dx, threshold);
  if (outcome) return outcome;
  if (Math.abs(dx) < FLICK_MIN_DISTANCE) return null;
  const velocity = Math.abs(dx) / Math.max(1, elapsedMs);
  if (velocity <= FLICK_VELOCITY) return null;
  return dx < 0 ? "left" : "right";
}
