"use client";

import { type ReactNode, useRef, useState } from "react";

import { Icon } from "./icon";
import { EDGE_GUARD, haptic, swipeAxis, swipeOutcome, swipeRelease, swipeThreshold } from "./motion";

/** Glissement de la ligne hors de l'écran avant la suppression. */
const EXIT_MS = 180;

type Gesture = {
  id: number;
  x: number;
  y: number;
  time: number;
  axis: "x" | "y" | null;
  armed: boolean;
  threshold: number;
};

/**
 * Ligne qui se glisse au doigt vers la gauche pour supprimer (toucher la ligne suffit pour la
 * modifier, d'où aucun geste vers la droite : la ligne ne bouge pas dans ce sens). Il faut un geste nettement horizontal, sur 40 % de la ligne, ou bien un petit geste vif ; en
 * deçà, la ligne revient en place. Pour supprimer, la ligne finit de sortir par la gauche. Raccourci tactile seulement : les mêmes actions restent
 * accessibles par les boutons de la ligne (clavier, lecteur d'écran), d'où les indications décoratives.
 */
export function SwipeRow({
  children,
  onSwipeLeft,
  leftLabel,
  muted = false,
}: {
  children: ReactNode;
  onSwipeLeft: () => void;
  /** Texte révélé en glissant vers la gauche (supprimer). */
  leftLabel: string;
  /** La ligne est posée sur un fond gris (plat du journal) : elle en prend la couleur. */
  muted?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false);

  const reset = () => {
    gesture.current = null;
    setDragging(false);
    setArmed(false);
    setDx(0);
  };

  const ready = leaving || armed;
  return (
    <div className="relative overflow-hidden rounded-xl">
      {(leaving || dx < -16) && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-end px-5 font-bold transition-colors duration-150 ${
            ready ? "bg-accent text-on-accent" : `${muted ? "bg-surface" : "bg-surface-muted"} text-text-muted`
          }`}
        >
          <span className={`flex items-center gap-2 transition-transform duration-150 ${ready ? "scale-110" : ""}`}>
            <Icon name="trash" size={20} />
            {ready && leftLabel}
          </span>
        </div>
      )}
      <div
        className={`relative touch-pan-y ${muted ? "bg-surface-muted active:bg-border" : "bg-surface active:bg-surface-muted"} ${
          dragging ? "transition-colors" : "transition-[transform,background-color] duration-200 ease-out-strong"
        }`}
        style={{
          transform: leaving ? "translateX(-100%)" : dx ? `translateX(${dx}px)` : undefined,
          transitionDuration: leaving ? `${EXIT_MS}ms` : undefined,
        }}
        onPointerDown={(event) => {
          moved.current = false;
          if (leaving || event.pointerType === "mouse" || event.clientX < EDGE_GUARD) return;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
            axis: null,
            armed: false,
            threshold: swipeThreshold(event.currentTarget.getBoundingClientRect().width),
          };
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          // Vers la droite, la ligne reste en place : seul le glissement vers la gauche agit.
          const deltaX = Math.min(0, event.clientX - g.x);
          g.axis ??= swipeAxis(event.clientX - g.x, event.clientY - g.y);
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
          const outcome =
            g.axis === "x"
              ? swipeRelease(Math.min(0, event.clientX - g.x), performance.now() - g.time, g.threshold)
              : null;
          reset();
          if (outcome === "left") {
            // La ligne file à gauche, puis la suppression la retire (et la liste se resserre).
            setLeaving(true);
            window.setTimeout(onSwipeLeft, EXIT_MS);
          }
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
