"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";

import { setCheckinAction } from "./actions";

const QUESTIONS = ["hunger", "energy", "mood"] as const;
type Question = (typeof QUESTIONS)[number];
const SCALE = [1, 2, 3, 4, 5] as const;

/** Ressenti du jour en 3 taps (facultatif, privé) : enregistré à chaque choix. */
export function CheckinCard({ date, initial }: { date: string; initial: Record<Question, number | null> }) {
  const t = useTranslations("checkin");
  const errorText = useErrorText();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const choose = (question: Question, value: number) => {
    setValues((current) => ({ ...current, [question]: value }));
    startTransition(async () => {
      const result = await setCheckinAction({ date, [question]: value });
      setError(result?.error ?? null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      {QUESTIONS.map((question) => (
        <fieldset key={question} className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t(`${question}.label`)}</legend>
          <div className="flex justify-between gap-1">
            {SCALE.map((value) => (
              <label
                key={value}
                className={`flex size-12 cursor-pointer items-center justify-center rounded-full border font-semibold has-[:focus-visible]:outline-2 ${
                  values[question] === value ? "border-primary bg-primary text-on-primary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name={`checkin-${question}`}
                  checked={values[question] === value}
                  onChange={() => choose(question, value)}
                  aria-label={t("scaleValue", { question: t(`${question}.label`), value })}
                  className="sr-only"
                />
                <span aria-hidden>{value}</span>
              </label>
            ))}
          </div>
          <p className="flex justify-between text-xs text-text-muted" aria-hidden>
            <span>{t(`${question}.low`)}</span>
            <span>{t(`${question}.high`)}</span>
          </p>
          <p className="sr-only">{t("scaleHint", { low: t(`${question}.low`), high: t(`${question}.high`) })}</p>
        </fieldset>
      ))}
    </div>
  );
}
