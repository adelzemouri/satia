"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { setWaterGoalAction } from "./actions";

export function WaterGoalForm({ goal }: { goal: number }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setState(await setWaterGoalAction(Number(formData.get("glasses"))));
        })
      }
      className="flex flex-col gap-3"
    >
      {state?.error && <Alert>{errorText(state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("foods.created")}</Alert>}
      <Field label={t("water.goalLabel")} name="glasses" type="number" min={1} max={20} defaultValue={goal} required />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
