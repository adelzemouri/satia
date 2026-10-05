"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { compressImage, toBase64 } from "@/features/ai/compress-image";
import { useErrorText } from "@/features/auth/use-error-text";
import { regenerateRecipePhotoAction, setRecipePhotoAction } from "@/features/journal/actions";
import { Alert } from "@/ui/alert";
import { buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

/** Côté long des photos de recette : nette en grand sur un téléphone, légère à stocker. */
const RECIPE_PHOTO_MAX_SIDE = 1080;

/**
 * Prendre ou choisir la photo d'une recette du foyer, ou remplacer celle générée par l'IA ;
 * une photo IA qui ne ressemble pas au plat peut aussi être refaite.
 */
export function RecipePhotoForm({
  foodId,
  hasPhoto,
  canRegenerate = false,
}: {
  foodId: string;
  hasPhoto: boolean;
  canRegenerate?: boolean;
}) {
  const t = useTranslations("foods.photo");
  const errorText = useErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File | undefined) => {
    if (!file) return;
    startTransition(async () => {
      try {
        const image = await compressImage(file, { maxSide: RECIPE_PHOTO_MAX_SIDE, quality: 0.8 });
        const result = await setRecipePhotoAction({
          foodId,
          imageBase64: await toBase64(image.blob),
          mime: image.mime,
        });
        setError(result?.error ?? null);
      } catch {
        setError("invalid_photo");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  };

  const regenerate = () =>
    startTransition(async () => {
      const result = await regenerateRecipePhotoAction(foodId);
      setError(result?.error ?? null);
    });

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="flex flex-wrap gap-3">
        <label className={`${buttonClass("secondary")} cursor-pointer ${pending ? "opacity-60" : ""}`}>
          <Icon name="camera" />
          {hasPhoto ? t("change") : t("add")}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </label>
        {canRegenerate && (
          <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={regenerate}>
            <Icon name="refresh" />
            {t("regenerate")}
          </button>
        )}
      </div>
      <p role="status" className="text-sm text-text-muted empty:hidden">
        {pending ? t("sending") : ""}
      </p>
    </div>
  );
}
