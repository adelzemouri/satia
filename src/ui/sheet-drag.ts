"use client";

import { type RefObject, useEffect, useRef } from "react";

import { prefersReducedMotion } from "./motion";

/** Glissement (px) à partir duquel la feuille se ferme au relâcher. */
const CLOSE_DISTANCE = 120;
/** Vitesse (px/ms) d'un geste vif vers le bas qui ferme même sur une courte distance. */
const CLOSE_VELOCITY = 0.5;

/**
 * Feuille du bas qu'on ferme en la tirant vers le bas, d'où que parte le doigt, tant que son
 * contenu est en haut. Si le contenu a défilé, le geste fait d'abord défiler, comme sur iPhone.
 * Téléphone seulement : sur ordinateur, la feuille est une fenêtre centrée.
 */
export function useSheetDrag(
  sheet: RefObject<HTMLElement | null>,
  onClose: () => void,
  /** Zone qui défile dans la feuille, si ce n'est pas la feuille elle-même. */
  scroller?: RefObject<HTMLElement | null>,
): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    let startY = 0;
    let startTime = 0;
    let offset = 0;
    let tracking = false;
    let dragging = false;

    const settle = (to: string, duration: number) => {
      element.style.transition = prefersReducedMotion()
        ? "none"
        : `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      element.style.transform = to;
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      tracking =
        event.touches.length === 1 &&
        touch !== undefined &&
        !window.matchMedia("(min-width: 1024px)").matches &&
        (scroller?.current ?? element).scrollTop <= 0;
      dragging = false;
      offset = 0;
      startY = touch?.clientY ?? 0;
      startTime = event.timeStamp;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      const delta = (event.touches[0]?.clientY ?? startY) - startY;
      if (!dragging && delta < 0) {
        // Vers le haut : le contenu défile normalement.
        tracking = false;
        return;
      }
      // Vers le bas depuis le haut du contenu : la feuille suit le doigt au lieu de rebondir.
      event.preventDefault();
      if (!dragging && delta < 6) return;
      dragging = true;
      offset = Math.max(0, delta);
      element.style.transition = "none";
      element.style.transform = `translateY(${offset}px)`;
    };

    const onEnd = (event: TouchEvent) => {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const velocity = offset / Math.max(1, event.timeStamp - startTime);
      if (offset > Math.min(CLOSE_DISTANCE, element.offsetHeight * 0.35) || velocity > CLOSE_VELOCITY) {
        settle("translateY(100%)", 180);
        window.setTimeout(
          () => {
            close.current();
            element.style.transition = "";
            element.style.transform = "";
          },
          prefersReducedMotion() ? 0 : 180,
        );
      } else {
        settle("", 220);
      }
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [sheet, scroller]);
}
