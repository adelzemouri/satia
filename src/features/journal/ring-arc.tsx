"use client";

import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { swapRemembered } from "@/ui/motion";

/**
 * Arc de l'anneau des calories. Il part de la dernière position affichée sur cet appareil plutôt
 * que de zéro : après un ajout, on voit l'anneau avancer de la part du repas.
 */
export function RingArc({
  radius,
  offset,
  over,
  memoryKey,
}: {
  radius: number;
  offset: number;
  over: boolean;
  memoryKey: string;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const length = 2 * Math.PI * radius;

  useLayoutEffect(() => {
    const from = swapRemembered(memoryKey, offset);
    const circle = ref.current;
    if (from === null || !circle) return;
    circle.style.setProperty("--ring-from", String(from));
    // Relance l'animation pour qu'elle parte de la nouvelle position.
    circle.style.animation = "none";
    void circle.getBoundingClientRect();
    circle.style.animation = "";
  }, [memoryKey, offset]);

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
      className={`ring-fill ${over ? "stroke-accent" : "stroke-primary"}`}
      style={{ "--ring-length": length } as CSSProperties}
    />
  );
}
