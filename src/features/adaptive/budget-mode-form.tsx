"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { BUDGET_MODES, type BudgetMode } from "@/domain/profile";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { OptionList } from "@/ui/option-list";

import { setBudgetModeAction } from "./actions";

/** Choix du mode de budget, enregistré dès la sélection. */
export function BudgetModeForm({ mode }: { mode: BudgetMode }) {
  const t = useTranslations("onboarding.budget");
  const errorText = useErrorText();
  const [value, setValue] = useState(mode);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const change = (next: BudgetMode) => {
    setValue(next);
    startTransition(async () => {
      const result = await setBudgetModeAction(next);
      setError(result?.error ?? null);
    });
  };

  return (
    <>
      {error && <Alert>{errorText(error)}</Alert>}
      <OptionList
        legend={t("title")}
        name="budgetMode"
        value={value}
        onChange={change}
        options={BUDGET_MODES.map((option) => ({
          value: option,
          label: t(`${option}.label`),
          hint: t(`${option}.hint`),
        }))}
      />
    </>
  );
}
