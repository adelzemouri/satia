"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { suggestRecipeStepsAction } from "./actions";

/** Recette sans préparation : le coach la rédige en un appel, puis elle s'affiche sur la fiche. */
export function RecipeStepsButton({ recipeId, coachName }: { recipeId: string; coachName: string }) {
  const t = useTranslations("recipes");
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      setError(null);
      const result = await suggestRecipeStepsAction(recipeId);
      if (result.error) setError(result.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert>{errorText(error) ?? errorText("generic")}</Alert>}
      <Button variant="secondary" onClick={ask} disabled={pending}>
        {pending ? t("stepsWriting", { name: coachName }) : t("stepsAsk", { name: coachName })}
      </Button>
    </div>
  );
}
