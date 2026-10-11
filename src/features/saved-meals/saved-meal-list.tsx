"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { serveSavedMealAction, unserveSavedMealAction } from "./actions";

export type SavedMealView = { id: string; name: string; labels: string[]; kcal: number };

/** « Mes repas » sur l'écran d'ajout : chaque repas enregistré s'ajoute au repas choisi d'un geste. */
export function SavedMealList({ meals, date, slot }: { meals: SavedMealView[]; date: string; slot: MealSlot }) {
  const t = useTranslations("savedMeals");
  const [error, setError] = useState<string | null>(null);
  const errorText = useErrorText();
  return (
    <section aria-labelledby="saved-meals-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="saved-meals-title" className="text-lg font-bold">
          {t("sectionTitle")}
        </h2>
        <Link href="/meals" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("manage")}
        </Link>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] bg-surface px-4">
        {meals.map((meal) => (
          <li key={meal.id} className="flex min-h-16 items-center gap-3 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold">{meal.name}</span>
              <span className="truncate text-sm text-text-muted">
                {t("items", { count: meal.labels.length })} · {meal.kcal} kcal
              </span>
            </span>
            <ServeButton meal={meal} date={date} slot={slot} onError={setError} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sert un repas enregistré dans le journal, avec « Annuler » dans le toast. */
export function ServeButton({
  meal,
  date,
  slot,
  onError,
  variant = "round",
}: {
  meal: Pick<SavedMealView, "id" | "name">;
  date: string;
  slot: MealSlot;
  onError: (code: string | null) => void;
  /** « round » : bouton rond « + » de l'écran d'ajout ; « pill » : bouton « Ajouter » des cartes de « Mes repas ». */
  variant?: "round" | "pill";
}) {
  const t = useTranslations();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const serve = () =>
    startTransition(async () => {
      onError(null);
      const result = await serveSavedMealAction({ id: meal.id, date, slot });
      if (result?.error) return onError(result.error);
      setAdded(true);
      haptic();
      const ids = result?.ids ?? [];
      toast({
        message: t("savedMeals.added", { name: meal.name, slot: t(`slotsLower.${slot}`) }),
        undo: () => {
          setAdded(false);
          void unserveSavedMealAction(ids);
        },
      });
    });

  const label = added ? t("savedMeals.addedButton", { name: meal.name }) : t("savedMeals.add", { name: meal.name });
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={serve}
        disabled={pending}
        aria-label={label}
        className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 font-semibold ${
          added ? "border-primary bg-primary text-on-primary" : "border-border text-primary hover:bg-surface-muted"
        }`}
      >
        <Icon name={added ? "check" : "plus"} size={18} />
        {added ? t("savedMeals.addedShort") : t("savedMeals.addShort")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={serve}
      disabled={pending}
      aria-label={label}
      className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${
        added ? "border-primary bg-primary text-on-primary" : "border-border text-text"
      }`}
    >
      <Icon name={added ? "check" : "plus"} />
    </button>
  );
}
