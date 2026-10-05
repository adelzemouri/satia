"use client";

import { type ReactNode, useRef } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { EDGE_GUARD, haptic, prefersReducedMotion, swipeAxis } from "@/ui/motion";

import { adjacentTab, tabSwipeThreshold } from "./tab-order";

type Gesture = { id: number; x: number; y: number; axis: "x" | "y" | null; width: number };

/** Le geste part-il d'un élément qui gère lui-même le glissement horizontal ? */
function ownsHorizontalGesture(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-swipe-lock], input, textarea, select, [role='slider'], [contenteditable='true']")) {
    return true;
  }
  // Carrousels et tableaux qui défilent horizontalement.
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
  }
  return false;
}

/**
 * Passage d'un onglet principal à l'autre en glissant le doigt vers la gauche ou la droite.
 * Raccourci tactile seulement : la barre du bas reste le moyen principal (clavier, lecteur
 * d'écran). Il faut un geste franc et nettement horizontal ; les bords de l'écran restent au
 * téléphone (retour arrière) et les lignes glissables du journal gardent leur propre geste.
 */
export function TabSwipe({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false);

  const place = (dx: number) => {
    const node = root.current;
    if (!node) return;
    if (dx === 0 || prefersReducedMotion()) {
      node.style.transform = "";
      node.style.opacity = "";
      return;
    }
    // Le contenu suit le doigt avec de la résistance, et s'estompe un peu.
    const shift = dx * 0.35;
    node.style.transform = `translateX(${shift}px)`;
    node.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900));
  };

  const reset = (animate: boolean) => {
    gesture.current = null;
    const node = root.current;
    if (node) node.style.transition = animate ? "transform 200ms ease-out, opacity 200ms ease-out" : "";
    place(0);
  };

  const enabled = adjacentTab(pathname, "left") !== null || adjacentTab(pathname, "right") !== null;

  return (
    <div
      ref={root}
      className={`flex flex-col gap-6 ${enabled ? "touch-pan-y" : ""}`}
      onPointerDown={(event) => {
        if (!enabled || event.pointerType === "mouse") return;
        const width = window.innerWidth;
        if (event.clientX < EDGE_GUARD || event.clientX > width - EDGE_GUARD) return;
        if (ownsHorizontalGesture(event.target, event.currentTarget)) return;
        moved.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, width };
        event.currentTarget.style.transition = "";
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x;
        g.axis ??= swipeAxis(dx, event.clientY - g.y);
        if (g.axis === "y") {
          gesture.current = null;
          return;
        }
        if (g.axis !== "x") return;
        // Pas d'onglet de ce côté : on ne suit pas le doigt.
        if (!adjacentTab(pathname, dx < 0 ? "left" : "right")) return;
        moved.current = true;
        place(dx);
      }}
      onPointerUp={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x;
        const target =
          g.axis === "x" && Math.abs(dx) >= tabSwipeThreshold(g.width)
            ? adjacentTab(pathname, dx < 0 ? "left" : "right")
            : null;
        reset(true);
        if (target) {
          haptic(8);
          router.push(target);
        }
      }}
      onPointerCancel={() => reset(true)}
      // Un glissement ne doit pas aussi compter comme un toucher sur un lien.
      onClickCapture={(event) => {
        if (!moved.current) return;
        moved.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
