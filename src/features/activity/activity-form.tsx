"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { ACTIVITY_TYPES, type ActivityType, type Intensity, INTENSITIES } from "@/domain/activity";
import { useErrorText } from "@/features/auth/use-error-text";
import { SelectField } from "@/features/body/select-field";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { addActivityAction } from "./actions";

export function ActivityForm({ today }: { today: string }) {
  const t = useTranslations("activity");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await addActivityAction({
        date: String(formData.get("date")),
        type: String(formData.get("type")) as ActivityType,
        intensity: String(formData.get("intensity")) as Intensity,
        durationMin: Number(formData.get("durationMin")),
      });
      setError(result?.error ? (result.fieldErrors?.durationMin ?? result.error) : null);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t("type")}
          name="type"
          options={ACTIVITY_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
        />
        <SelectField
          label={t("intensity")}
          name="intensity"
          defaultValue="moderate"
          options={INTENSITIES.map((intensity) => ({ value: intensity, label: t(`intensities.${intensity}`) }))}
        />
        <Field label={t("duration")} name="durationMin" type="number" inputMode="numeric" min={1} max={600} required />
        <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
      </div>
      <p className="text-sm text-text-muted">{t("intensityHint")}</p>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
