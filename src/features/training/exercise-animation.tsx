"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { Muscle } from "@/domain/training/types";
import { Icon } from "@/ui/icon";

import { ExerciseArt } from "./exercise-art";

/**
 * Illustration animée d'un exercice, avec un bouton pour mettre l'animation en pause
 * (WCAG 2.2.2). Si l'utilisateur préfère réduire les animations, la position clé est
 * affichée sans mouvement et le bouton disparaît.
 */
export function ExerciseAnimation({
  exerciseId,
  muscle,
  name,
  className,
}: {
  exerciseId: string;
  muscle: Muscle;
  name: string;
  className?: string;
}) {
  const t = useTranslations("training.art");
  const svg = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const element = svg.current;
    if (!element) return;
    if (paused) element.unpauseAnimations();
    else element.pauseAnimations();
    setPaused(!paused);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <ExerciseArt
        ref={svg}
        exerciseId={exerciseId}
        muscle={muscle}
        label={t("label", { name })}
        animate
        className="block h-auto w-full"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? t("play") : t("pause")}
        className="absolute right-2 bottom-2 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-sm hover:bg-surface-muted motion-reduce:hidden"
      >
        <Icon name={paused ? "play" : "pause"} />
      </button>
    </div>
  );
}
