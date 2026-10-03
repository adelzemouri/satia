"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";

import { Icon } from "@/ui/icon";

import { setWaterAction } from "./actions";

/** Tuile de l'accueil : le compte des verres du jour et un bouton pour en ajouter un. */
export function WaterTile({ date, glasses, goal }: { date: string; glasses: number; goal: number }) {
  const t = useTranslations("water");
  const [optimistic, setOptimistic] = useOptimistic(glasses);
  const [, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setOptimistic(optimistic + 1);
      await setWaterAction(date, optimistic + 1);
    });

  return (
    <section aria-labelledby="water-title" className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4">
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
