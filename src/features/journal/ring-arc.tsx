"use client";

import { type CSSProperties, useLayoutEffect, useRef } from "react";

/**
 * Arc de l'anneau des calories. Il se remplit depuis zéro à chaque arrivée sur la page, puis part
 * de sa position précédente quand la valeur change sur place : on voit l'anneau avancer du repas.
 */
export function RingArc({ radius, offset, over }: { radius: number; offset: number; over: boolean }) {
  const ref = useRef<SVGCircleElement>(null);
  const shown = useRef<number | null>(null);
  const length = 2 * Math.PI * radius;

  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = offset;
    const circle = ref.current;
    // Premier affichage : l'animation CSS part déjà de l'anneau vide.
    if (from === null || from === offset || !circle) return;
    circle.style.setProperty("--ring-from", String(from));
    // Relance l'animation pour qu'elle parte de la nouvelle position.
    circle.style.animation = "none";
    void circle.getBoundingClientRect();
    circle.style.animation = "";
  }, [offset]);

  return (
    <circle
      ref={ref}
      cx="64"
      cy="64"
      r={radius}
      fill="none"
      strokeWidth="12"
      strokeLinecap="round"
      strokeDasharray={length}
      strokeDashoffset={offset}
      className={`ring-fill ${over ? "stroke-text-muted" : "stroke-primary"}`}
      style={{ "--ring-length": length } as CSSProperties}
    />
  );
}
