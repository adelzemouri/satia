"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { generateMenuAction } from "./actions";

const SLOTS = ["breakfast", "lunch", "dinner"] as const;

/** Demande au coach de remplir les repas vides de la semaine. */
export function GenerateMenuForm({ weekStart, disabledReason }: { weekStart: string; disabledReason: string | null }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setMessage(null);
          const slots = SLOTS.filter((slot) => formData.get(slot) === "on");
          const result = await generateMenuAction({ weekStart, slots, servings: Number(formData.get("servings")) });
          setMessage(
            result.error
              ? { tone: "error", text: errorText(result.error) ?? "" }
              : { tone: "success", text: t("plan.generated", { count: result.added ?? 0 }) },
          );
        })
      }
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-text-muted">{t("plan.generateHint")}</p>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 font-semibold">{t("plan.generateSlots")}</legend>
        {SLOTS.map((slot) => (
          <label key={slot} className="flex min-h-12 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name={slot}
              defaultChecked={slot !== "breakfast"}
              className="size-5 accent-primary"
            />
            {t(`slots.${slot}`)}
          </label>
        ))}
      </fieldset>
      <Field label={t("plan.servingsLabel")} name="servings" type="number" min={1} max={20} defaultValue={4} required />
      {disabledReason && <p className="text-sm text-text-muted">{errorText(disabledReason)}</p>}
      {pending && (
        <p role="status" className="text-text-muted">
          {t("plan.generating")}
        </p>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" disabled={pending || disabledReason !== null}>
        {t("plan.generate")}
      </Button>
    </form>
  );
}
