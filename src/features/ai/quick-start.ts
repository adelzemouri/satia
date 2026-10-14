/**
 * Départ rapide de la saisie IA depuis le + de la barre du bas : la photo déjà prise ou la dictée
 * à lancer est remise à l'écran d'ajout, qu'il soit déjà ouvert ou qu'il s'ouvre juste après.
 */
export type QuickStart = { kind: "photo"; file: File } | { kind: "voice" };

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
