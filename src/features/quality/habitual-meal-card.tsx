"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { addHabitualMealAction } from "./actions";

/** « Ton petit-déj habituel ? » : le repas le plus fréquent du créneau, ajoutable en un tap. */
export function HabitualMealCard({
  meal,
  date,
}: {
  meal: { fromDate: string; slot: MealSlot; labels: string[]; kcal: number };
  date: string;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await addHabitualMealAction({ fromDate: meal.fromDate, slot: meal.slot, toDate: date });
      if (result?.error) setError(result.error);
      else router.push({ pathname: "/journal", query: { date } });
    });

  return (
    <section
      aria-labelledby="habitual-title"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-primary-soft p-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="habitual-title" className="text-sm font-bold text-primary">
            {t("habitual.title", { slot: meal.slot })}
          </h2>
          <p className="font-bold">{meal.labels.join(", ")}</p>
          <p className="text-sm">{t("common.kcal", { value: meal.kcal })}</p>
        </div>
        <Button onClick={add} disabled={pending} className="shrink-0 px-5">
          {t("habitual.add")}
        </Button>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
    </section>
  );
}
