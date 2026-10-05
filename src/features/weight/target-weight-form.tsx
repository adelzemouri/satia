"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { setTargetWeightAction } from "@/features/journal/actions";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useToast } from "@/ui/toast";

/** Modifier le poids visé ; vide pour ne plus en avoir. */
export function TargetWeightForm({ target, minKg }: { target: number | null; minKg: number }) {
  const t = useTranslations("weight");
  const format = useFormatter();
  const errorText = useErrorText();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const raw = String(formData.get("targetWeightKg") ?? "").trim();
      const result = await setTargetWeightAction(raw ? Number(raw.replace(",", ".")) : null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      toast({ message: t("targetSaved") });
    });

  return (
    <form action={submit} className="flex flex-col gap-3">
      {error && (
        <Alert>
          {error === "below_healthy_bmi" ? errorText(error, { min: format.number(minKg) }) : errorText(error)}
        </Alert>
      )}
      <Field
        label={t("targetLabel")}
        hint={t("targetHint")}
        name="targetWeightKg"
        inputMode="decimal"
        defaultValue={target ?? undefined}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("targetSave")}
      </Button>
    </form>
  );
}
