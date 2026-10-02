"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { SelectField } from "@/features/body/select-field";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { logTreatmentAction } from "./actions";

/** Note une prise : traitement suivi ou nom libre, date, heure et note. Aucune dose. */
export function TreatmentLogForm({
  treatments,
  today,
  now,
}: {
  treatments: { id: string; name: string }[];
  today: string;
  now: string;
}) {
  const t = useTranslations("treatment.log");
  const errorText = useErrorText();
  const [choice, setChoice] = useState(treatments[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await logTreatmentAction({
        treatmentId: choice || null,
        name: String(formData.get("name") ?? ""),
        date: String(formData.get("date")),
        time: String(formData.get("time")),
        note: String(formData.get("note") ?? ""),
      });
      setError(result?.error ?? null);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      {treatments.length > 0 && (
        <SelectField
          label={t("which")}
          name="treatmentId"
          defaultValue={choice}
          onChange={setChoice}
          options={[
            ...treatments.map((treatment) => ({ value: treatment.id, label: treatment.name })),
            { value: "", label: t("other") },
          ]}
        />
      )}
      {!choice && <Field label={t("name")} name="name" maxLength={80} required />}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
        <Field label={t("time")} name="time" type="time" defaultValue={now} required />
      </div>
      <Field label={t("note")} hint={t("noteHint")} name="note" maxLength={300} />
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
