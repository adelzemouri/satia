"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { ProductThumb } from "@/features/foods/product-thumb";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { portionLabel } from "@/domain/portions";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { formatDay } from "@/ui/format-date";

import { respondToShareAction } from "./actions";

/** Portions proposées en un tap ; « autre » permet de saisir des grammes. */
const PORTIONS = [0.5, 1, 1.5, 2] as const;

export type PendingShareView = {
  sharedMealId: string;
  dishName: string;
  imageUrl: string | null;
  fromName: string | null;
  date: string;
  slot: MealSlot;
  totalParts: number;
  partGrams: number;
  partKcal: number;
};

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

function PendingShare({ share }: { share: PendingShareView }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const [portion, setPortion] = useState<number | "grams">(1);
  const [grams, setGrams] = useState(String(Math.round(share.partGrams)));
  const [slot, setSlot] = useState<MealSlot>(share.slot);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleId = `share-${share.sharedMealId}`;

  const eatenGrams = portion === "grams" ? Number(grams.replace(",", ".")) || 0 : share.partGrams * portion;
  const eatenKcal = Math.round((share.partKcal / share.partGrams) * eatenGrams);

  const respond = (accept: boolean) =>
    startTransition(async () => {
      const result = await respondToShareAction(
        share.sharedMealId,
        accept
          ? {
              accept: true,
              parts: portion === "grams" ? null : portion,
              grams: portion === "grams" ? Number(grams.replace(",", ".")) : null,
              slot,
            }
          : { accept: false },
      );
      if (result?.error) setError(result.error);
    });

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border p-3" aria-labelledby={titleId}>
      <div className="flex items-start gap-3">
        {share.imageUrl && <ProductThumb src={share.imageUrl} size={48} />}
        <div className="flex min-w-0 flex-col">
          <h3 id={titleId} className="font-semibold">
            {share.dishName}
          </h3>
          <p className="text-sm text-text-muted">
            {t("family.sharedBy", {
              name: share.fromName ?? t("family.someone"),
              slot: t(`slotsLower.${share.slot}`),
              day: formatDay(share.date, locale),
            })}
          </p>
          <p className="text-sm text-text-muted">
            {t("family.partInfo", {
              parts: share.totalParts,
              grams: Math.round(share.partGrams),
              kcal: share.partKcal,
            })}
          </p>
        </div>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("family.myPortion")}</legend>
        <div className="flex flex-wrap gap-2">
          {PORTIONS.map((value) => (
            <label
              key={value}
              className={`flex min-h-12 cursor-pointer items-center rounded-full border px-4 font-semibold has-[:focus-visible]:outline-2 ${
                portion === value ? "border-primary bg-primary text-on-primary" : "border-border"
              }`}
            >
              <input
                type="radio"
                name={`portion-${share.sharedMealId}`}
                checked={portion === value}
                onChange={() => setPortion(value)}
                className="sr-only"
              />
              {t("family.parts", { value: portionLabel(value), count: value })}
            </label>
          ))}
          <label
            className={`flex min-h-12 cursor-pointer items-center rounded-full border px-4 font-semibold has-[:focus-visible]:outline-2 ${
              portion === "grams" ? "border-primary bg-primary text-on-primary" : "border-border"
            }`}
          >
            <input
              type="radio"
              name={`portion-${share.sharedMealId}`}
              checked={portion === "grams"}
              onChange={() => setPortion("grams")}
              className="sr-only"
            />
            {t("family.inGrams")}
          </label>
        </div>
        {portion === "grams" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("family.gramsLabel")}</span>
            <input
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </label>
        )}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("journal.slot")}</span>
        <select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot)} className={inputClass}>
          {MEAL_SLOTS.map((value) => (
            <option key={value} value={value}>
              {t(`slots.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm font-semibold" aria-live="polite">
        {t("family.portionPreview", { grams: Math.round(eatenGrams), kcal: eatenKcal })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => respond(true)} disabled={pending || eatenGrams <= 0}>
          {t("family.accept")}
        </Button>
        <Button variant="ghost" onClick={() => respond(false)} disabled={pending}>
          {t("family.decline")}
        </Button>
      </div>
    </li>
  );
}

/** Repas partagés par la famille, en attente de validation : rien n'entre au journal sans accord. */
export function PendingShares({ shares }: { shares: PendingShareView[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {shares.map((share) => (
        <PendingShare key={share.sharedMealId} share={share} />
      ))}
    </ul>
  );
}
