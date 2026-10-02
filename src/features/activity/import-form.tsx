"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { IMPORT_MAX_BYTES } from "@/domain/activity-import";
import { useErrorText } from "@/features/auth/use-error-text";
import type { ImportResult } from "@/server/activity";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { importActivityAction } from "./actions";

/** Import d'un export CSV : le fichier est lu dans le navigateur puis envoyé en texte. */
export function ImportForm() {
  const t = useTranslations("activity.import");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      setDone(null);
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) return setError("import_invalid");
      if (file.size > IMPORT_MAX_BYTES) return setError("import_too_large");
      const response = await importActivityAction(await file.text());
      setError(response?.error ?? null);
      if (response?.result) setDone(response.result);
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t("hint")}</p>
      {error && <Alert>{errorText(error)}</Alert>}
      {done && (
        <Alert tone="success">
          {t("done", { days: done.days, activities: done.activities, skipped: done.skipped })}
        </Alert>
      )}
      <Field label={t("file")} name="file" type="file" accept=".csv,text/csv" required />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
