"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { suggestedMealName } from "@/domain/saved-meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { saveMealAction } from "./actions";

/** Sous un repas du journal : l'enregistrer dans « Mes repas », avec un nom proposé. */
export function SaveMealButton({ date, slot, labels }: { date: string; slot: MealSlot; labels: string[] }) {
  const t = useTranslations("savedMeals");
  const errorText = useErrorText();
  const toast = useToast();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Icon name="bookmark" />
        {t("save")}
      </Button>
    );
  }

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await saveMealAction({ date, slot, name: String(formData.get("name") ?? "") });
      if (result?.error) return setError(result.error);
      haptic();
      toast({ message: t("saved") });
      setError(null);
      setOpen(false);
    });

  return (
    <form action={save} className="flex w-full flex-col gap-3 rounded-2xl bg-surface-muted p-3">
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
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
