"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { NotificationPrefs } from "@/domain/notifications";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { setNotificationPrefsAction } from "./actions";

const TYPES = [
  ["meals", "mealsHint"],
  ["water", "waterHint"],
  ["weeklyReview", "weeklyReviewHint"],
] as const;

/** Types de rappels et plage silencieuse (communs à tous les appareils). */
export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const t = useTranslations("notifications");
  const errorText = useErrorText();
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setState(
            await setNotificationPrefsAction({
              meals: formData.get("meals") === "on",
              water: formData.get("water") === "on",
              weeklyReview: formData.get("weeklyReview") === "on",
              quietStart: String(formData.get("quietStart")),
              quietEnd: String(formData.get("quietEnd")),
            }),
          );
        })
      }
      className="flex flex-col gap-3"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("types")}</legend>
        {TYPES.map(([name, hint]) => (
          <div key={name} className="flex min-h-12 items-start gap-3 py-1">
            <input
              id={`notify-${name}`}
              type="checkbox"
              name={name}
              defaultChecked={prefs[name]}
              aria-describedby={`notify-${name}-hint`}
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col">
              <label htmlFor={`notify-${name}`} className="cursor-pointer font-semibold">
                {t(name)}
              </label>
              <span id={`notify-${name}-hint`} className="text-sm text-text-muted">
                {t(hint)}
              </span>
            </span>
          </div>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("quiet")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("quietStart")} name="quietStart" type="time" defaultValue={prefs.quietStart} required />
          <Field label={t("quietEnd")} name="quietEnd" type="time" defaultValue={prefs.quietEnd} required />
        </div>
      </fieldset>
      {state?.error && <Alert>{errorText(state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
