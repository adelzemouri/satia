"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";

import { GLASS_ML } from "@/domain/water";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";

import { setWaterAction } from "./actions";
import { Glass } from "./glass";

/**
 * Verres d'eau du jour : toucher un verre fixe le total à ce verre (ou le retire s'il était le dernier).
 * Les verres notés dans les repas (`fromMeals`) restent pleins : ils se retirent depuis le repas.
 */
export function WaterTracker({
  date,
  glasses,
  fromMeals,
  goal,
  onGoalReached,
}: {
  date: string;
  glasses: number;
  fromMeals: number;
  goal: number;
  /** Appelé quand un verre ajouté atteint l'objectif du jour. */
  onGoalReached?: () => void;
}) {
  const t = useTranslations("water");
  const [optimistic, setOptimistic] = useOptimistic(glasses);
  const [, startTransition] = useTransition();
  const slots = Math.max(goal, optimistic);

  const set = (value: number) =>
    startTransition(async () => {
      const total = Math.max(value, fromMeals);
      setOptimistic(total);
      haptic();
      if (goal > 0 && total === goal && total > optimistic) onGoalReached?.();
      await setWaterAction(date, total - fromMeals);
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted" aria-live="polite">
        {t("count", { glasses: optimistic, goal })}
        <span aria-hidden="true">
          {" · "}
          {t("ml", { value: optimistic * GLASS_ML, goal: goal * GLASS_ML })}
        </span>
        {fromMeals > 0 && <span className="block text-xs">{t("fromMeals", { count: fromMeals })}</span>}
      </p>
      <ul className="flex flex-wrap gap-1">
        {Array.from({ length: Math.min(slots + 1, 30) }, (_, i) => {
          const n = i + 1;
          const full = n <= optimistic;
          return (
            <li key={n}>
              <button
                type="button"
                aria-label={t("glass", { n })}
                aria-pressed={full}
                onClick={() => set(full && n === optimistic ? n - 1 : n)}
                className="relative flex h-12 w-9 items-center justify-center rounded-xl"
              >
                {/* Même dessin que la carte Eau de l'accueil ; la case en plus permet de dépasser l'objectif. */}
                <Glass full={full} fresh={full && n === optimistic} />
                {n > slots && (
                  <span className="absolute inset-0 flex items-center justify-center text-text-muted">
                    <Icon name="plus" size={14} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
