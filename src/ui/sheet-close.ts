"use client";

import { type SyntheticEvent, useCallback, useState } from "react";

import { prefersReducedMotion } from "./motion";

/** Durée de la sortie d'une feuille (animation `sheet-out` de globals.css). */
export const SHEET_EXIT_MS = 180;

/**
 * Ferme une feuille `<dialog>` en la faisant redescendre (fondu sur ordinateur), puis la ferme
 * vraiment. Sans animation si l'utilisateur la réduit, ou si la feuille vient d'être tirée hors
 * de l'écran au doigt.
 */
export function closeSheet(dialog: HTMLDialogElement | null | undefined): void {
  if (!dialog?.open || dialog.hasAttribute("data-closing")) return;
  if (prefersReducedMotion() || dialog.style.transform !== "") {
    dialog.close();
    return;
  }
  dialog.setAttribute("data-closing", "");
  window.setTimeout(() => {
    dialog.removeAttribute("data-closing");
    dialog.close();
  }, SHEET_EXIT_MS);
}

/** Échap : la feuille redescend aussi, au lieu de disparaître d'un coup. */
export function cancelSheet(event: SyntheticEvent<HTMLDialogElement>): void {
  event.preventDefault();
  closeSheet(event.currentTarget);
}

/**
 * Pour une feuille qui n'est pas un `<dialog>` (elle disparaît quand le parent la retire) :
 * `dismiss` joue la sortie puis appelle `onClose`. `closing` sert à poser `sheet-out` sur la
 * feuille et `fade-out` sur le voile.
 */
export function useSheetExit(
  onClose: () => void,
  sheet: { current: HTMLElement | null },
): { closing: boolean; dismiss: () => void } {
  const [closing, setClosing] = useState(false);
  const dismiss = useCallback(() => {
    if (closing) return;
    if (prefersReducedMotion() || (sheet.current?.style.transform ?? "") !== "") {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, SHEET_EXIT_MS);
  }, [closing, onClose, sheet]);
  return { closing, dismiss };
}
