"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { Icon } from "./icon";
import { useSheetDrag } from "./sheet-drag";

/**
 * Panneau qui monte du bas sur téléphone (on le ferme en le tirant vers le bas) et fenêtre
 * centrée sur ordinateur. Ouvert ou fermé par le parent (`open`), comme une boîte de dialogue.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  /** Contenu qui défile (une liste) : la feuille prend presque toute la hauteur du téléphone. */
  tall?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useSheetDrag(dialog, onClose, scroller);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    // Échap ferme au clavier ; le toucher sur le fond grisé est un raccourci tactile.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`sheet-in fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-[1.75rem] bg-surface p-0 text-text backdrop:bg-text/45 lg:inset-0 lg:m-auto lg:max-w-lg lg:rounded-[1.75rem] ${
        tall ? "h-[88dvh] lg:h-[min(44rem,88vh)]" : "h-fit"
      }`}
    >
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6 lg:pt-5 lg:pb-6">
        <span aria-hidden="true" className="h-1.5 w-10 shrink-0 self-center rounded-full bg-border lg:hidden" />
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="flex-1 font-display text-xl font-extrabold tracking-tight first-letter:uppercase">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted"
          >
            <Icon name="close" />
          </button>
        </div>
        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {open && children}
        </div>
      </div>
    </dialog>
  );
}
