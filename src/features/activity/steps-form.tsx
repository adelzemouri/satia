"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { setStepsAction } from "./actions";

export function StepsForm({ today, todaySteps }: { today: string; todaySteps: number }) {
  const t = useTranslations("activity.steps");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await setStepsAction({
        date: String(formData.get("date")),
        steps: Number(String(formData.get("steps")).replace(/\s/g, "")),
      });
      setError(result?.error ? (result.fieldErrors?.steps ?? result.error) : null);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("count")} name="steps" inputMode="numeric" defaultValue={todaySteps || undefined} required />
        <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
      </div>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
