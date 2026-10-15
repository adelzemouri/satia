"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { suggestedMealName } from "@/domain/saved-meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { saveMealAction } from "./actions";

/** Depuis le menu d'un repas du journal : l'enregistrer dans « Mes repas », avec un nom proposé. */
export function SaveMealForm({
  date,
  slot,
  labels,
  onDone,
  onCancel,
}: {
  date: string;
  slot: MealSlot;
  labels: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("savedMeals");
  const errorText = useErrorText();
  const toast = useToast();
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await saveMealAction({ date, slot, name: String(formData.get("name") ?? "") });
      if (result?.error) return setError(result.error);
      haptic();
      toast({ message: t("saved") });
      setError(null);
      onDone();
    });

  return (
    <form action={save} className="flex w-full flex-col gap-3">
      {error && <Alert>{errorText(error)}</Alert>}
      <label htmlFor={inputId} className="font-semibold">
        {t("nameLabel")}
      </label>
      <input
        id={inputId}
        name="name"
        required
        maxLength={60}
        defaultValue={suggestedMealName(labels)}
        className="min-h-12 rounded-2xl border border-border bg-surface px-3 text-base"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("confirm")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
