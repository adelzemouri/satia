"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { MEASUREMENT_KINDS, type MeasurementKind } from "@/domain/activity";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { setMeasurementAction } from "./actions";
import { SelectField } from "./select-field";

export function MeasurementForm({ today }: { today: string }) {
  const t = useTranslations("body");
  const errorText = useErrorText();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await setMeasurementAction({
        date: String(formData.get("date")),
        kind: String(formData.get("kind")) as MeasurementKind,
        valueCm: Number(String(formData.get("valueCm")).replace(",", ".")),
      });
      if (result?.error) setError(result.fieldErrors?.valueCm ?? result.error);
      else {
        setError(null);
        form.current?.reset();
      }
    });

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t("kind")}
          name="kind"
          options={MEASUREMENT_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        />
        <Field label={t("value")} name="valueCm" inputMode="decimal" required />
      </div>
      <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
