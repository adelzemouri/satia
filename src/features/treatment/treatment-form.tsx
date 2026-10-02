"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { addTreatmentAction } from "./actions";

const chipClass =
  "flex min-h-12 cursor-pointer items-center rounded-full border-2 border-border bg-surface px-4 font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]";

/** Ajout d'un traitement suivi, avec un rappel facultatif (jours et heure). */
export function TreatmentForm() {
  const t = useTranslations("treatment.add");
  const tw = useTranslations("training.weekdays");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const reminderTime = String(formData.get("reminderTime") ?? "");
      const result = await addTreatmentAction({
        name: String(formData.get("name")),
        reminderTime: reminderTime || null,
        reminderDays: formData.getAll("day").map(Number),
      });
      setError(result?.error ? (result.fieldErrors?.name ?? result.error) : null);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <Field label={t("name")} hint={t("nameHint")} name="name" maxLength={80} required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("reminder")}</legend>
        <p className="text-sm text-text-muted">{t("reminderHint")}</p>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <label key={day} className={chipClass}>
              <input type="checkbox" name="day" value={day} className="sr-only" />
              {tw(String(day) as "0")}
            </label>
          ))}
        </div>
        <Field label={t("time")} name="reminderTime" type="time" />
      </fieldset>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
