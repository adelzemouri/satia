"use client";

import { useTranslations } from "next-intl";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { saveAiSettingsAction } from "./ai-actions";

export function AiSettingsForm({
  enabled,
  budgetUsd,
  defaultBudgetUsd,
}: {
  enabled: boolean;
  budgetUsd: number | null;
  defaultBudgetUsd: number;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(saveAiSettingsAction, null);
  return (
    <form {...action} className="flex flex-col gap-3">
      {state?.error && <Alert>{errorText(state.error === "invalid_form" ? "generic" : state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("common.save")} ✓</Alert>}
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 accent-primary" />
        <span>{t("aiAdmin.enabled")}</span>
      </label>
      <Field
        label={t("aiAdmin.budget")}
        hint={t("aiAdmin.budgetHint", { amount: defaultBudgetUsd })}
        name="budget"
        inputMode="decimal"
        defaultValue={budgetUsd ?? ""}
        placeholder={String(defaultBudgetUsd)}
      />
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
