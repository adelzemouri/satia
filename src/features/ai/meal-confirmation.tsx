"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { shortFoodName } from "@/domain/food-name";
import { useErrorText } from "@/features/auth/use-error-text";
import { FoodSearchBox } from "@/features/foods/food-search-box";
import { DishName } from "@/features/journal/dish-name";
import { defaultUnit, type FoodItem } from "@/features/foods/food-types";
import { ProductThumb } from "@/features/foods/product-thumb";
import { dishAfterSwap, groupByDish } from "@/domain/dishes";
import { checkLine, type LineCheck } from "@/domain/meal-checks";
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

/** État relu d'une ligne : une modification (aliment, quantité, unité) demande une nouvelle relecture. */
function signature(line: Line): string {
  return `${line.food?.id ?? line.estimate?.name ?? ""}|${line.quantityText}|${line.unit}`;
}

/** Points à relire d'une ligne, une fois ses valeurs calculées. */
function checksFor(line: Line, values: { grams: number; nutrients: Nutrients } | null): LineCheck[] {
  if (!values) return [];
  // L'aliment vient d'une habitude, ou l'utilisateur l'a choisi lui-même : rien à soupçonner.
  const chosen = line.fromHabit === true || line.aiLabel === null || line.food?.id !== line.proposal?.foodId;
  return checkLine({
    label: line.label,
    food: line.food,
    chosen,
    grams: values.grams,
    kcal: values.nutrients.kcal,
  });
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
  /** Lignes signalées que l'utilisateur a relues, avec l'état relu. */
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => (photoPreview ? URL.revokeObjectURL(photoPreview) : undefined), [photoPreview]);

  const update = (key: string, change: Partial<Line>) =>
    setLines((list) => list.map((line) => (line.key === key ? { ...line, ...change } : line)));

  const changeFood = (line: Line, food: FoodItem) => {
    // On garde le poids : l'unité passe en grammes si l'ancienne n'existe pas pour ce nouvel aliment.
    const grams = compute(line)?.grams;
    const keepUnit = availableUnits(food).includes(line.unit);
    // « Riz sauté au porc » devient « Riz sauté au veau » quand le porc est remplacé par du veau.
    const oldNames = [line.label, line.aiLabel, line.food?.nameFr, line.estimate?.name].filter((name): name is string =>
      Boolean(name),
    );
    const dish = line.dish ? dishAfterSwap(line.dish, oldNames, food.nameFr) : null;
    const sameDish = (other: Line) => line.dish && other.dish?.trim().toLowerCase() === line.dish.trim().toLowerCase();
    setLines((list) =>
      list.map((other) => {
        if (other.key === line.key)
          return {
            ...other,
            food,
            estimate: null,
            searching: false,
            ...(dish && { dish }),
            ...(!keepUnit && { unit: "g" as Unit, quantityText: String(Math.round(grams ?? 100)) }),
          };
        return dish && sameDish(other) ? { ...other, dish } : other;
      }),
    );
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
  const computedByKey = new Map(lines.map((line, index) => [line.key, computed[index]]));
  const checksByKey = new Map(lines.map((line, index) => [line.key, checksFor(line, computed[index] ?? null)]));
  const toReview = lines.filter(
    (line) => (checksByKey.get(line.key) ?? []).length > 0 && reviewed[line.key] !== signature(line),
  );
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
          dish: line.dish ?? null,
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
      {toReview.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold">
          <Icon name="alert" size={20} />
          {t("aiConfirm.toReview", { count: toReview.length })}
        </p>
      )}

      {groupByDish(lines).map((group) => {
        const lineList = (
          <ul className="flex flex-col gap-3">
            {group.items.map((line) => {
              const values = computedByKey.get(line.key) ?? null;
              const name = line.food ? shortFoodName(line.food.nameFr) : line.estimate?.name;
              const units: Unit[] = line.food ? availableUnits(line.food) : ["g"];
              const checks = checksByKey.get(line.key) ?? [];
              const pendingReview = checks.length > 0 && reviewed[line.key] !== signature(line);
              return (
                <li
                  key={line.key}
                  className={`flex flex-col gap-3 rounded-2xl border p-3 ${pendingReview ? "border-accent" : "border-border"}`}
                >
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
                  {line.count && line.unit === "g" && line.quantityText === String(line.quantity) && (
                    <p className="text-sm text-text-muted">
                      {t("aiConfirm.countHint", { count: line.count, each: Math.round(line.quantity / line.count) })}
                    </p>
                  )}
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
                  {checks.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3 text-sm">
                      <ul className="flex flex-col gap-1">
                        {checks.map((check) => (
                          <li key={check} className="flex items-start gap-2">
                            <span className="mt-0.5">
                              <Icon name="alert" size={18} />
                            </span>
                            {t(`aiConfirm.checks.${check}`, { label: line.label })}
                          </li>
                        ))}
                      </ul>
                      {pendingReview ? (
                        <Button
                          variant="secondary"
                          className="min-h-11 self-start px-4 text-sm"
                          onClick={() => setReviewed((map) => ({ ...map, [line.key]: signature(line) }))}
                        >
                          <Icon name="check" />
                          {t("aiConfirm.looksRight", { name: name ?? line.label })}
                        </Button>
                      ) : (
                        <p className="flex items-center gap-2 font-semibold">
                          <Icon name="check" size={18} />
                          {t("aiConfirm.reviewed")}
                        </p>
                      )}
                    </div>
                  )}
                  {line.searching ? (
                    <FoodSearchBox
                      label={t("aiConfirm.searchFor", { label: line.label })}
                      suggestions={line.alternatives}
                      onSelect={(food) => changeFood(line, food)}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      className="min-h-11 self-start px-4 text-sm"
                      onClick={() => update(line.key, { searching: true })}
                    >
                      <Icon name="search" />
                      {t("aiConfirm.changeFood")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        );
        if (group.dish === null) return <div key={group.items[0]!.key}>{lineList}</div>;
        const dishKcal = sumNutrients(group.items.flatMap((line) => computedByKey.get(line.key)?.nutrients ?? [])).kcal;
        return (
          <section key={group.dish} aria-label={group.dish} className="flex flex-col gap-2">
            <div className="font-semibold">
              <DishName
                name={group.dish}
                heading
                trailing={
                  <span className="text-sm text-text-muted">{t("common.kcal", { value: Math.round(dishKcal) })}</span>
                }
                onSave={(dish) => {
                  const keys = new Set(group.items.map((line) => line.key));
                  setLines((list) => list.map((line) => (keys.has(line.key) ? { ...line, dish } : line)));
                  return null;
                }}
              />
            </div>
            {lineList}
          </section>
        );
      })}

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
        <Button type="submit" disabled={pending || !complete || toReview.length > 0}>
          {t("aiConfirm.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t("aiConfirm.restart")}
        </Button>
      </div>
    </form>
  );
}
