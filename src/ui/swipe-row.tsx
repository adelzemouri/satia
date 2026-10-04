"use client";

import { type ReactNode, useRef, useState } from "react";

import { Icon } from "./icon";
import { haptic, SWIPE_THRESHOLD, swipeAxis, swipeOutcome } from "./motion";

/**
 * Ligne qui se glisse au doigt : vers la gauche pour supprimer, vers la droite pour modifier.
 * Raccourci tactile seulement : les mêmes actions restent accessibles par les boutons de la
 * ligne (clavier, lecteur d'écran), d'où les indications décoratives.
 */
export function SwipeRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
}: {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Texte révélé en glissant vers la gauche (supprimer). */
  leftLabel: string;
  /** Texte révélé en glissant vers la droite (modifier). */
  rightLabel: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; armed: boolean } | null>(null);
  const moved = useRef(false);

  const reset = () => {
    gesture.current = null;
    setDragging(false);
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx !== 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-4 font-bold ${
            dx < 0 ? "justify-end bg-accent text-on-accent" : "justify-start bg-primary text-on-primary"
          }`}
        >
          <span
            className={`flex items-center gap-2 transition-transform duration-150 ${
              Math.abs(dx) >= SWIPE_THRESHOLD ? "scale-110" : ""
            }`}
          >
            <Icon name={dx < 0 ? "trash" : "edit"} size={20} />
            {dx < 0 ? leftLabel : rightLabel}
          </span>
        </div>
      )}
      <div
        className={`relative touch-pan-y bg-surface ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          moved.current = false;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, armed: false };
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          const deltaX = event.clientX - g.x;
          g.axis ??= swipeAxis(deltaX, event.clientY - g.y);
          if (g.axis !== "x") return;
          if (!dragging) {
            setDragging(true);
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Pointeur déjà relâché : le geste continue sans capture.
            }
          }
          moved.current = true;
          // Petite vibration au passage du seuil, pour sentir que l'action est prête.
          const armed = swipeOutcome(deltaX) !== null;
          if (armed && !g.armed) haptic(8);
          g.armed = armed;
          setDx(deltaX);
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          const outcome = g.axis === "x" ? swipeOutcome(event.clientX - g.x) : null;
          reset();
          if (outcome === "left") onSwipeLeft();
          if (outcome === "right") onSwipeRight();
        }}
        onPointerCancel={reset}
        // Un glissement ne doit pas aussi compter comme un toucher sur la ligne.
        onClickCapture={(event) => {
          if (!moved.current) return;
          moved.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}
