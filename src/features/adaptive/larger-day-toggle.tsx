"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";

import { setLargerDayAction } from "./actions";

/** Case « jour plus large » d'un jour à venir de la semaine. */
export function LargerDayToggle({ date, larger, dayLabel }: { date: string; larger: boolean; dayLabel: string }) {
  const t = useTranslations("week");
  const errorText = useErrorText();
  const [checked, setChecked] = useState(larger);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      const result = await setLargerDayAction(date, next);
      if (result?.error) {
        setChecked(!next);
        setError(result.error);
      } else {
        setError(null);
      }
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => toggle(event.target.checked)}
          aria-label={t("largerFor", { day: dayLabel })}
          className="size-5 accent-primary"
        />
        <span aria-hidden>{t("larger")}</span>
      </label>
      {error && <Alert>{errorText(error)}</Alert>}
    </span>
  );
}
