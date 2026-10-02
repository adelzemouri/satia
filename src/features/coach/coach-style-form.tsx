"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { COACH_STYLES, type CoachStyle } from "@/domain/profile";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { OptionList } from "@/ui/option-list";

import { setCoachStyleAction } from "./actions";

/** Choix de la personnalité du coach, enregistré dès la sélection. */
export function CoachStyleForm({ style }: { style: CoachStyle }) {
  const t = useTranslations("coach");
  const errorText = useErrorText();
  const [value, setValue] = useState(style);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const change = (next: CoachStyle) => {
    setValue(next);
    startTransition(async () => {
      const result = await setCoachStyleAction(next);
      setError(result?.error ?? null);
    });
  };

  return (
    <>
      {error && <Alert>{errorText(error)}</Alert>}
      <OptionList
        legend={t("styleTitle")}
        hideLegend
        name="coachStyle"
        value={value}
        onChange={change}
        options={COACH_STYLES.map((option) => ({
          value: option,
          label: t(`styles.${option}.label`),
          hint: t(`styles.${option}.hint`),
        }))}
      />
    </>
  );
}
