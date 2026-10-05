"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { setWaterAction } from "./actions";

/** Contenance d'un verre, pour afficher aussi le total en millilitres. */
const GLASS_ML = 250;
/** Au-delà, les verres ne tiennent plus sur une ligne de téléphone : on n'en dessine pas plus. */
const MAX_DRAWN = 12;

/**
 * Carte de l'accueil : un verre dessiné par verre de l'objectif, rempli au fur et à mesure,
 * et deux boutons pour en ajouter ou en retirer un.
 */
export function WaterTile({ date, glasses, goal }: { date: string; glasses: number; goal: number }) {
  const t = useTranslations("water");
  const [optimistic, setOptimistic] = useOptimistic(glasses);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const [celebrating, setCelebrating] = useState(false);

  const remove = () =>
    startTransition(async () => {
      if (optimistic === 0) return;
      setOptimistic(optimistic - 1);
      haptic();
      await setWaterAction(date, optimistic - 1);
    });

  const add = () =>
    startTransition(async () => {
      setOptimistic(optimistic + 1);
      haptic();
      if (goal > 0 && optimistic + 1 === goal) {
        setCelebrating(true);
        haptic([12, 60, 12]);
        toast({ message: t("goalReached") });
      }
      await setWaterAction(date, optimistic + 1);
    });

  const drawn = Math.min(MAX_DRAWN, Math.max(goal, optimistic));
  return (
    <section
      aria-labelledby="water-title"
      className={`flex flex-col gap-3 rounded-[var(--radius-card)] p-5 ${celebrating ? "celebrate bg-primary-soft" : "bg-surface"}`}
      onAnimationEnd={() => setCelebrating(false)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 id="water-title" className="text-lg font-bold">
            {t("title")}
          </h2>
          <p className="text-sm text-text-muted" aria-live="polite">
            {t("count", { glasses: optimistic, goal })}
            <span aria-hidden="true">
              {" · "}
              {t("ml", { value: optimistic * GLASS_ML, goal: goal * GLASS_ML })}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={optimistic === 0}
            aria-label={t("removeGlass")}
            className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-text disabled:opacity-40"
          >
            <Icon name="minus" />
          </button>
          <button
            type="button"
            onClick={add}
            aria-label={t("addGlass")}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-hidden="true">
        {Array.from({ length: drawn }, (_, index) => (
          <li key={index}>
            <Glass full={index < optimistic} fresh={index === optimistic - 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Verre stylisé : contour, et eau qui monte quand il est compté. */
function Glass({ full, fresh }: { full: boolean; fresh: boolean }) {
  return (
    <svg viewBox="0 0 24 30" className={`h-8 w-6 ${fresh ? "pop" : ""}`}>
      <path
        d="M3 3h18l-2.2 23.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"
        className={full ? "fill-fat/25 stroke-fat" : "fill-none stroke-border"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {full && <path d="M5.4 11h13.2l-1.6 15H7z" className="fill-fat" />}
    </svg>
  );
}
