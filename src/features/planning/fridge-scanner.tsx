"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useState, useTransition } from "react";

import { compressImage, toBase64 } from "@/features/ai/compress-image";
import { useErrorText } from "@/features/auth/use-error-text";
import { useRouter } from "@/i18n/navigation";
import type { FridgeResult } from "@/server/planning";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { fridgeIdeasAction, saveIdeaAction } from "./actions";

/**
 * Photo du frigo ou du placard, réduite côté client puis envoyée une fois : ingrédients
 * repérés et 3 idées chiffrées depuis la base. Une idée peut devenir une recette et
 * rejoindre le journal.
 */
export function FridgeScanner() {
  const t = useTranslations("fridge");
  const errorText = useErrorText();
  const router = useRouter();
  const [result, setResult] = useState<FridgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const image = await compressImage(file);
        const response = await fridgeIdeasAction({ imageBase64: await toBase64(image.blob), mime: image.mime });
        if (response.error) setError(response.error);
        else if (response.result) setResult(response.result);
      } catch {
        setError("photo_unreadable");
      }
    });
  };

  const save = (idea: FridgeResult["ideas"][number]) =>
    startTransition(async () => {
      setError(null);
      const response = await saveIdeaAction({
        name: idea.name,
        items: idea.items.map((item) => ({ foodId: item.foodId, grams: item.grams })),
      });
      if (response.id) router.push({ pathname: "/add", query: { food: response.id } });
      else setError(response.error ?? "generic");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <label className={buttonClass("secondary", "cursor-pointer px-3 focus-within:outline-2")}>
          <Icon name="camera" />
          {t("takePhoto")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choosePhoto}
            disabled={pending}
            className="sr-only"
          />
        </label>
        <label className={buttonClass("secondary", "cursor-pointer px-3 focus-within:outline-2")}>
          <Icon name="image" />
          {t("choosePhoto")}
          <input type="file" accept="image/*" onChange={choosePhoto} disabled={pending} className="sr-only" />
        </label>
      </div>

      <div aria-live="polite" className="flex flex-col gap-4">
        {pending && !result && <p className="text-text-muted">{t("analyzing")}</p>}
        {error && <Alert>{errorText(error)}</Alert>}
        {result && (
          <>
            {result.ingredients.length > 0 && <p>{t("seen", { list: result.ingredients.join(", ") })}</p>}
            {result.remainingKcal !== null && (
              <p className="text-text-muted">{t("remaining", { kcal: Math.max(0, result.remainingKcal) })}</p>
            )}
            <h2 className="text-xl font-semibold">{t("ideas")}</h2>
            {result.ideas.length === 0 ? (
              <p className="text-text-muted">{t("noIdeas")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {result.ideas.map((idea) => (
                  <li
                    key={idea.name}
                    aria-label={idea.name}
                    className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-4"
                  >
                    <h3 className="font-semibold">{idea.name}</h3>
                    <p className="text-sm">
                      {t("kcal", { kcal: idea.kcal })} · {idea.fits ? t("fits") : t("over")}
                    </p>
                    <p className="text-sm text-text-muted">
                      {idea.items.map((item) => `${item.name} (${item.grams} g)`).join(", ")}
                    </p>
                    {idea.missing.length > 0 && (
                      <p className="text-sm text-text-muted">{t("missing", { list: idea.missing.join(", ") })}</p>
                    )}
                    <Button variant="secondary" onClick={() => save(idea)} disabled={pending}>
                      {t("save")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
