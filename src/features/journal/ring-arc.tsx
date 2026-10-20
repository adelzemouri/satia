"use client";

import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { lastShown, rememberShown } from "@/ui/motion";

const MEMORY_KEY = "ring-arc";

/** Avancée de l'anneau quand un repas s'ajoute (ou se retire). */
const CHANGE_ANIMATION = "ring-fill 800ms var(--ease-out-strong)";

/**
 * Arc de l'anneau des calories. Il se remplit depuis zéro à l'ouverture de l'app ; ensuite il
 * reprend là où on l'a laissé, et seul l'écart s'anime : en revenant sur l'accueil après un ajout,
 * on voit l'anneau avancer du repas, sans rejouer tout le remplissage.
 */
export function RingArc({ radius, offset, over }: { radius: number; offset: number; over: boolean }) {
  const ref = useRef<SVGCircleElement>(null);
  const shown = useRef<number | null>(null);
  const length = 2 * Math.PI * radius;

  useLayoutEffect(() => {
    const circle = ref.current;
    const mounting = shown.current === null;
    // Premier rendu : on part de ce que l'anneau montrait avant de quitter l'accueil, s'il y en a.
    const from = shown.current ?? lastShown(MEMORY_KEY) ?? null;
    shown.current = offset;
    rememberShown(MEMORY_KEY, offset);
    // Ouverture de l'app : l'animation CSS part de l'anneau vide.
    if (from === null || !circle) return;
    if (from === offset) {
      // Déjà vu à cette valeur : affiché tel quel (un second passage de l'effet ne touche à rien).
      if (mounting) circle.style.animation = "none";
      return;
    }
    circle.style.setProperty("--ring-from", String(from));
    // Relance l'animation pour qu'elle parte de la position précédente.
    circle.style.animation = "none";
    void circle.getBoundingClientRect();
    circle.style.animation = CHANGE_ANIMATION;
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
