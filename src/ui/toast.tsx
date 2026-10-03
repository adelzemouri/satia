"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Durée d'affichage d'un message, le temps de toucher « Annuler ». */
const DURATION_MS = 5000;

export type ToastInput = {
  message: string;
  /** Présent : un bouton « Annuler » l'appelle et `onExpire` n'est alors pas appelé. */
  undo?: () => void;
  /** Appelé quand le message disparaît sans annulation (délai écoulé, nouveau message, page quittée). */
  onExpire?: () => void;
};

type Shown = ToastInput & { id: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Affiche un court message en bas de l'écran, au-dessus de la barre de navigation. */
export function useToast() {
  return useContext(ToastContext);
}

/**
 * Un seul message à la fois : en afficher un nouveau valide le précédent. Le fournisseur vit dans
 * le layout de l'app, donc un message survit au changement de page (ajout puis journal).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [toast, setToast] = useState<Shown | null>(null);
  const current = useRef<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextId = useRef(0);

  const close = useCallback((undone: boolean) => {
    clearTimeout(timer.current);
    const closing = current.current;
    current.current = null;
    setToast(null);
    if (!closing) return;
    if (undone) closing.undo?.();
    else closing.onExpire?.();
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      close(false);
      nextId.current += 1;
      const shown = { ...input, id: nextId.current };
      current.current = shown;
      setToast(shown);
      timer.current = setTimeout(() => close(false), DURATION_MS);
    },
    [close],
  );

  // Une suppression en attente est faite même si l'app est fermée pendant le délai.
  useEffect(() => {
    const flush = () => close(false);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [close]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="toast-in pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl bg-text py-2 pr-2 pl-4 text-bg shadow-lg"
          >
            <span className="min-w-0 flex-1 font-semibold">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => close(true)}
                className="min-h-10 shrink-0 rounded-full px-3 font-bold text-primary-soft underline-offset-4 hover:underline"
              >
                {t("undo")}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
