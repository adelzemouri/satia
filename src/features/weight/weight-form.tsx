"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { setWeightAction } from "@/features/journal/actions";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

export function WeightForm({ today, lastWeight }: { today: string; lastWeight: number | null }) {
  const t = useTranslations("weight");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await setWeightAction({
        date: String(formData.get("date")),
        weightKg: Number(String(formData.get("weightKg")).replace(",", ".")),
      });
      setError(result?.error ? (result.fieldErrors?.weightKg ?? result.error) : null);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
        <Field
          label={t("weight")}
          name="weightKg"
          inputMode="decimal"
          defaultValue={lastWeight ?? undefined}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
