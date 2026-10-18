"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { deleteFoodAction } from "@/features/journal/actions";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

/** Supprime une recette du foyer depuis sa fiche, après confirmation : elle disparaît pour toute la famille. */
export function DeleteRecipeButton({ id }: { id: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        {t("foods.deleteRecipe")}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={t("foods.deleteRecipe")} className="flex flex-col gap-3">
      <p className="font-semibold">{t("foods.deleteRecipeConfirm")}</p>
      <p className="text-sm text-text-muted">{t("foods.deleteRecipeHint")}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteFoodAction(id);
              if (result?.error) setError(result.error);
              else router.replace("/recipes");
            })
          }
        >
          {t("foods.deleteRecipe")}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
    </div>
  );
}
