"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";

import { Icon } from "@/ui/icon";

import { setWaterAction } from "./actions";

/** Verres d'eau du jour : toucher un verre fixe le total à ce verre (ou le retire s'il était le dernier). */
export function WaterTracker({ date, glasses, goal }: { date: string; glasses: number; goal: number }) {
  const t = useTranslations("water");
  const [optimistic, setOptimistic] = useOptimistic(glasses);
  const [, startTransition] = useTransition();
  const slots = Math.max(goal, optimistic);

  const set = (value: number) =>
    startTransition(async () => {
      setOptimistic(value);
      await setWaterAction(date, value);
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold" aria-live="polite">
        {t("count", { glasses: optimistic, goal })}
      </p>
      <ul className="flex flex-wrap gap-2">
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
                className={`flex size-11 items-center justify-center rounded-2xl border ${
                  full ? "border-fat bg-fat/15 text-fat" : "border-border text-text-muted"
                }`}
              >
                <Icon name={n > slots ? "plus" : "drop"} filled={full} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
