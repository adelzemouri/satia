"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { setExerciseExcludedAction } from "./actions";

/** Réintègre un exercice mis de côté après une douleur. */
export function RestoreExerciseButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("training.library");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await setExerciseExcludedAction(id, false)))}
      aria-label={t("restoreLabel", { name })}
      className="min-h-12 rounded-full px-3 font-semibold text-primary hover:bg-surface-muted"
    >
      {t("restore")}
    </button>
  );
}
