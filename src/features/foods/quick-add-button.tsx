"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { addEntryAction } from "@/features/journal/actions";
import { useOfflineQueue } from "@/features/offline/offline-provider";
import { isNetworkFailure } from "@/features/offline/pending-queue";
import { Icon } from "@/ui/icon";

import type { RecentItem } from "./food-types";

/**
 * Ajout en un geste d'un aliment récent, avec la dernière portion saisie. Sans réseau, la ligne
 * attend sur le téléphone comme une saisie normale. La portion se corrige ensuite dans le journal.
 */
export function QuickAddButton({
  food,
  date,
  slot,
  onError,
}: {
  food: RecentItem;
  date: string;
  slot: MealSlot;
  onError: (error: string) => void;
}) {
  const t = useTranslations("add");
  const offline = useOfflineQueue();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const input = { date, slot, foodId: food.id, quantity: food.lastQuantity, unit: food.lastUnit };
      const queue = () => {
        offline!.queue({ ...input, inputMethod: "manual", label: food.nameFr, kcal: Math.round(food.lastKcal) });
        setAdded(true);
      };
      if (offline && !navigator.onLine) return queue();
      try {
        const result = await addEntryAction(input);
        if (result?.error) onError(result.error);
        else setAdded(true);
      } catch (failure) {
        if (offline && isNetworkFailure(failure)) queue();
        else onError("generic");
      }
    });

  return (
    <button
      type="button"
      onClick={add}
      disabled={pending}
      aria-label={added ? t("quickAdded", { name: food.nameFr }) : t("quickAdd", { name: food.nameFr })}
      className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${
        added ? "border-primary bg-primary text-on-primary" : "border-border text-text"
      }`}
    >
      <Icon name={added ? "check" : "plus"} />
    </button>
  );
}
