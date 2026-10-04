"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { addEntryAction, deleteEntryAction } from "@/features/journal/actions";
import { useOfflineQueue } from "@/features/offline/offline-provider";
import { isNetworkFailure } from "@/features/offline/pending-queue";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

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
  const tSlots = useTranslations("slotsLower");
  const toast = useToast();
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
        if (result?.error) return onError(result.error);
        setAdded(true);
        haptic();
        const id = result?.id;
        toast({
          message: t("addedTo", { name: food.nameFr, slot: tSlots(slot) }),
          undo: id
            ? () => {
                setAdded(false);
                void deleteEntryAction(id);
              }
            : undefined,
        });
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
