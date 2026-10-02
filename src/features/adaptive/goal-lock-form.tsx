"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { setGoalLockedAction } from "./actions";

/** Figer l'objectif (le bilan hebdomadaire ne le modifie plus) ou le laisser s'ajuster. */
export function GoalLockForm({ locked }: { locked: boolean }) {
  const t = useTranslations("metabolism");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const result = await setGoalLockedAction(!locked);
      setError(result?.error ?? null);
    });

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert>{errorText(error)}</Alert>}
      <p className="text-text-muted">{locked ? t("lockedHint") : t("unlockedHint")}</p>
      <Button variant="secondary" onClick={toggle} disabled={pending}>
        {locked ? t("unlock") : t("lock")}
      </Button>
    </div>
  );
}
