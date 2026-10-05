"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { WaterTracker } from "./water-tracker";

/**
 * Carte de l'accueil : les mêmes verres que le journal, à toucher pour fixer le total du jour.
 * L'eau notée dans les repas (`fromMeals`) est comptée mais ne se retire que depuis le repas.
 */
export function WaterTile({
  date,
  glasses,
  fromMeals,
  goal,
}: {
  date: string;
  glasses: number;
  fromMeals: number;
  goal: number;
}) {
  const t = useTranslations("water");
  const toast = useToast();
  const [celebrating, setCelebrating] = useState(false);

  return (
    <section
      aria-labelledby="water-title"
      className={`flex flex-col gap-3 rounded-[var(--radius-card)] p-5 ${celebrating ? "celebrate bg-primary-soft" : "bg-surface"}`}
      onAnimationEnd={() => setCelebrating(false)}
    >
      <h2 id="water-title" className="text-lg font-bold">
        {t("title")}
      </h2>
      <WaterTracker
        date={date}
        glasses={glasses}
        fromMeals={fromMeals}
        goal={goal}
        onGoalReached={() => {
          setCelebrating(true);
          haptic([12, 60, 12]);
          toast({ message: t("goalReached") });
        }}
      />
    </section>
  );
}
