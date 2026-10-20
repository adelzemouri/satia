"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { haptic } from "@/ui/motion";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";

import { addPlanItemAction } from "./actions";
import { DayPicker, dayName, ServingsStepper, SlotPicker } from "./menu-controls";

/**
 * « Ajouter au menu » sur la fiche d'une recette : on choisit le jour, le repas et les parts
 * sans passer par la page Menu.
 */
export function AddToMenuButton({
  foodId,
  name,
  today,
  defaultServings,
}: {
  foodId: string;
  name: string;
  today: string;
  defaultServings: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [servings, setServings] = useState(defaultServings);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const when = t("plan.when", { day: dayName(date, locale), slot });

  const submit = () =>
    startTransition(async () => {
      const result = await addPlanItemAction({ date, slot, foodId, label: "", servings });
      if (result?.error) {
        setError(result.error);
        return;
      }
      haptic();
      setOpen(false);
      toast({ message: t("plan.addedTo", { name, when }) });
    });

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={buttonClass("secondary")}
      >
        {t("plan.addToMenu")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("plan.addToMenu")} closeLabel={t("plan.close")}>
        <DayPicker today={today} value={date} onChange={setDate} />
        <SlotPicker value={slot} onChange={setSlot} />
        <ServingsStepper value={servings} onChange={setServings} />
        {error && <Alert>{errorText(error)}</Alert>}
        <Button variant="primary" onClick={submit} disabled={pending}>
          {t("plan.addOn", { when })}
        </Button>
      </Sheet>
    </>
  );
}
