"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { setWaterAction } from "./actions";

/** Tuile de l'accueil : le compte des verres du jour et un bouton pour en ajouter un. */
export function WaterTile({ date, glasses, goal }: { date: string; glasses: number; goal: number }) {
  const t = useTranslations("water");
  const [optimistic, setOptimistic] = useOptimistic(glasses);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const [celebrating, setCelebrating] = useState(false);

  const add = () =>
    startTransition(async () => {
      setOptimistic(optimistic + 1);
      if (goal > 0 && optimistic + 1 === goal) {
        setCelebrating(true);
        haptic([12, 60, 12]);
        toast({ message: t("goalReached") });
      }
      await setWaterAction(date, optimistic + 1);
    });

  return (
    <section
      aria-labelledby="water-title"
      className={`flex flex-col gap-2 rounded-[var(--radius-card)] p-4 ${celebrating ? "celebrate bg-primary-soft" : "bg-surface"}`}
      onAnimationEnd={() => setCelebrating(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-fat">
          <Icon name="drop" />
        </span>
        <button
          type="button"
          onClick={add}
          aria-label={t("addGlass")}
          className="-mt-1 -mr-1 flex size-12 items-center justify-center rounded-full bg-surface-muted text-text"
        >
          <Icon name="plus" />
        </button>
      </div>
      <h2 id="water-title" className="font-bold">
        {t("title")}
      </h2>
      <p className="text-sm text-text-muted" aria-live="polite">
        {t("count", { glasses: optimistic, goal })}
      </p>
    </section>
  );
}
