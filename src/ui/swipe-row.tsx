"use client";

import { type ReactNode, useRef, useState } from "react";

import { Icon } from "./icon";
import { EDGE_GUARD, haptic, swipeAxis, swipeOutcome, swipeThreshold } from "./motion";

type Gesture = { id: number; x: number; y: number; axis: "x" | "y" | null; armed: boolean; threshold: number };

/**
 * Ligne qui se glisse au doigt : vers la gauche pour supprimer, vers la droite pour modifier.
 * Il faut un geste franc (nettement horizontal, sur 40 % de la ligne) pour déclencher l'action ;
 * en deçà, la ligne revient en place. Raccourci tactile seulement : les mêmes actions restent
 * accessibles par les boutons de la ligne (clavier, lecteur d'écran), d'où les indications décoratives.
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
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false);

  const reset = () => {
    gesture.current = null;
    setDragging(false);
    setArmed(false);
    setDx(0);
  };

  const left = dx < 0;
  return (
    <div data-swipe-lock className="relative overflow-hidden rounded-xl">
      {Math.abs(dx) > 16 && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-5 font-bold transition-colors duration-150 ${
            left ? "justify-end" : "justify-start"
          } ${
            armed
              ? left
                ? "bg-accent text-on-accent"
                : "bg-primary text-on-primary"
              : "bg-surface-muted text-text-muted"
          }`}
        >
          <span className={`flex items-center gap-2 transition-transform duration-150 ${armed ? "scale-110" : ""}`}>
            <Icon name={left ? "trash" : "edit"} size={20} />
            {armed && (left ? leftLabel : rightLabel)}
          </span>
        </div>
      )}
      <div
        className={`relative touch-pan-y bg-surface ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" || event.clientX < EDGE_GUARD) return;
          moved.current = false;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            axis: null,
            armed: false,
            threshold: swipeThreshold(event.currentTarget.getBoundingClientRect().width),
          };
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
          const ready = swipeOutcome(deltaX, g.threshold) !== null;
          if (ready && !g.armed) haptic(8);
          g.armed = ready;
          setArmed(ready);
          setDx(deltaX);
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          const outcome = g.axis === "x" ? swipeOutcome(event.clientX - g.x, g.threshold) : null;
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
