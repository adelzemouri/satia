/**
 * Départ rapide de la saisie IA depuis l'appareil photo du + : la photo déjà prise, la dictée à
 * lancer ou le champ à écrire est remis à l'écran d'ajout, qu'il soit déjà ouvert ou qu'il s'ouvre
 * juste après.
 */
export type QuickStart = { kind: "photo"; file: File } | { kind: "voice" } | { kind: "write" };

let pending: QuickStart | null = null;
let listener: ((start: QuickStart) => void) | null = null;

export function requestQuickStart(start: QuickStart): void {
  if (listener) listener(start);
  else pending = start;
}

/** Abonne l'écran d'ajout ; un départ demandé avant son ouverture lui est remis aussitôt. */
export function onQuickStart(handler: (start: QuickStart) => void): () => void {
  listener = handler;
  if (pending) {
    const start = pending;
    pending = null;
    handler(start);
  }
  return () => {
    if (listener === handler) listener = null;
  };
}
