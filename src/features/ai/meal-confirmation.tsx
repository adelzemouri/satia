"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { FoodSearchBox } from "@/features/foods/food-search-box";
import { defaultUnit, type FoodItem } from "@/features/foods/food-types";
import { ProductThumb } from "@/features/foods/product-thumb";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { type Nutrients, nutrientsFor, sumNutrients } from "@/domain/nutrition";
import { availableUnits, toGrams, type Unit } from "@/domain/units";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { saveMealAction } from "./actions";
import type { DraftItem, MealDraft } from "./draft";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

type Line = DraftItem & { quantityText: string; searching: boolean };

function toLine(item: DraftItem): Line {
  return { ...item, quantityText: String(item.quantity), searching: false };
}

/** Grammes et valeurs d'une ligne, ou null tant qu'elle est incomplète. */
function compute(line: Line): { grams: number; nutrients: Nutrients } | null {
  const per100 = line.food ?? line.estimate;
  if (!per100) return null;
  const amount = Number(line.quantityText.replace(",", "."));
  const grams = line.food ? toGrams(amount, line.unit, line.food) : line.unit === "g" && amount > 0 ? amount : null;
  return grams === null ? null : { grams, nutrients: nutrientsFor(per100, grams) };
}

/**
 * Écran de confirmation de la saisie IA : chaque aliment reconnu reste modifiable (aliment,
 * quantité, unité) ou supprimable avant l'ajout au journal. Les corrections servent ensuite
 * de règles locales.
 */
export function MealConfirmation({
  draft,
  photoPreview,
  date,
  slot: initialSlot,
  onCancel,
}: {
  draft: MealDraft;
  photoPreview: string | null;
  date: string;
  slot: MealSlot;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => draft.items.map(toLine));
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => (photoPreview ? URL.revokeObjectURL(photoPreview) : undefined), [photoPreview]);

  const update = (key: string, change: Partial<Line>) =>
    setLines((list) => list.map((line) => (line.key === key ? { ...line, ...change } : line)));

  const changeFood = (line: Line, food: FoodItem) => {
    // On garde le poids : l'unité passe en grammes si l'ancienne n'existe pas pour ce nouvel aliment.
    const grams = compute(line)?.grams;
    const keepUnit = availableUnits(food).includes(line.unit);
    update(line.key, {
      food,
      estimate: null,
      searching: false,
      ...(!keepUnit && { unit: "g", quantityText: String(Math.round(grams ?? 100)) }),
    });
  };

  const addFood = (food: FoodItem) => {
    const unit = defaultUnit(availableUnits(food));
    setLines((list) => [
      ...list,
      {
        key: crypto.randomUUID(),
        label: food.nameFr,
        aiLabel: null,
        proposal: null,
        food,
        estimate: null,
        quantity: unit === "g" ? 100 : 1,
        unit,
        alternatives: [],
        quantityText: unit === "g" ? "100" : "1",
        searching: false,
      },
    ]);
    setAdding(false);
  };

  const computed = lines.map(compute);
  const complete = lines.length > 0 && computed.every(Boolean);
  const total = sumNutrients(computed.flatMap((value) => (value ? [value.nutrients] : [])));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveMealAction({
        date,
        slot,
        method: draft.method,
        photoId: draft.photoId,
        items: lines.map((line) => ({
          foodId: line.food?.id ?? null,
          estimate: line.food ? null : line.estimate,
          quantity: Number(line.quantityText.replace(",", ".")),
          unit: line.unit,
          aiLabel: line.aiLabel,
          proposal: line.proposal,
        })),
      });
      if (result?.error) setError(result.error);
      else router.push({ pathname: "/journal", query: { date } });
    });

  return (
    <form action={save} className="flex flex-col gap-4" aria-labelledby="confirm-title">
      <div className="flex flex-col gap-1">
        <h2 id="confirm-title" className="text-xl font-semibold">
          {t("aiConfirm.title")}
        </h2>
        <p className="text-sm text-text-muted">{t(draft.usedAi ? "aiConfirm.hint" : "aiConfirm.hintLocal")}</p>
      </div>
      {photoPreview && (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob)
        <img src={photoPreview} alt={t("aiEntry.photoAlt")} className="max-h-48 w-full rounded-2xl object-cover" />
      )}
      {error && <Alert>{errorText(error)}</Alert>}
      {lines.length === 0 && <p className="text-text-muted">{t("aiConfirm.nothingFound")}</p>}

      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const values = computed[index];
          const name = line.food?.nameFr ?? line.estimate?.name;
          const units: Unit[] = line.food ? availableUnits(line.food) : ["g"];
          return (
            <li key={line.key} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <div className="flex items-start gap-3">
                {line.food?.imageUrl && <ProductThumb src={line.food.imageUrl} size={48} />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="font-semibold">{name ?? t("aiConfirm.noMatch")}</p>
                  {line.aiLabel !== null && name !== line.label && (
                    <p className="text-sm text-text-muted">{t("aiConfirm.recognized", { label: line.label })}</p>
                  )}
                  {!line.food && line.estimate && (
                    <p className="text-sm font-semibold text-text-muted">{t("aiConfirm.estimated")}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLines((list) => list.filter((item) => item.key !== line.key))}
                  aria-label={t("aiConfirm.remove", { name: name ?? line.label })}
                  className="flex size-12 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("journal.quantity")}</span>
                  <input
                    inputMode="decimal"
                    value={line.quantityText}
                    onChange={(event) => update(line.key, { quantityText: event.target.value })}
                    aria-label={t("aiConfirm.quantityOf", { name: name ?? line.label })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("journal.unit")}</span>
                  <select
                    value={line.unit}
                    onChange={(event) => update(line.key, { unit: event.target.value as Unit })}
                    className={inputClass}
                  >
                    {units.map((value) => (
                      <option key={value} value={value}>
                        {t(`units.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-sm" aria-live="polite">
                {values
                  ? t("aiConfirm.values", {
                      kcal: Math.round(values.nutrients.kcal),
                      protein: Math.round(values.nutrients.proteinG),
                      carbs: Math.round(values.nutrients.carbsG),
                      fat: Math.round(values.nutrients.fatG),
                    })
                  : t("aiConfirm.incomplete")}
              </p>
              {line.searching ? (
                <FoodSearchBox
                  label={t("aiConfirm.searchFor", { label: line.label })}
                  suggestions={line.alternatives}
                  onSelect={(food) => changeFood(line, food)}
                />
              ) : (
                <Button
                  variant="ghost"
                  className="self-start px-3"
                  onClick={() => update(line.key, { searching: true })}
                >
                  {t("aiConfirm.changeFood")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <FoodSearchBox label={t("aiConfirm.addLabel")} onSelect={addFood} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          {t("aiConfirm.addFood")}
        </Button>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("journal.slot")}</span>
        <select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot)} className={inputClass}>
          {MEAL_SLOTS.map((value) => (
            <option key={value} value={value}>
              {t(`slots.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-2xl bg-surface-muted px-4 py-3 font-semibold" aria-live="polite">
        {t("aiConfirm.total", { kcal: Math.round(total.kcal) })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !complete}>
          {t("aiConfirm.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t("aiConfirm.restart")}
        </Button>
      </div>
    </form>
  );
}
