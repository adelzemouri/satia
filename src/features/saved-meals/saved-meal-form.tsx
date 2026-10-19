"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { shortFoodName } from "@/domain/food-name";
import type { SavedMealItem } from "@/db/schema";
import { nutrientsFor } from "@/domain/nutrition";
import { savedMealKcal, scaleSavedItem } from "@/domain/saved-meals";
import { availableUnits, toGrams, type Unit } from "@/domain/units";
import { useErrorText } from "@/features/auth/use-error-text";
import { FoodList } from "@/features/foods/food-list";
import { defaultUnit, type FoodItem } from "@/features/foods/food-types";
import { useFoodSearch } from "@/features/foods/use-food-search";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { SearchInput } from "@/ui/search-input";
import { useToast } from "@/ui/toast";

import { updateSavedMealAction } from "./actions";

/** Ligne déjà dans le repas (repérée par sa position d'origine) ou aliment ajouté ici. */
type Row =
  | { key: string; kind: "kept"; index: number; item: SavedMealItem; quantity: string }
  | { key: string; kind: "added"; food: FoodItem; unit: Unit; quantity: string };

function parseQuantity(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Valeurs d'une ligne à sa quantité saisie, pour le total affiché (le serveur recalcule). */
function rowNutrients(row: Row): { kcal: number } | null {
  const quantity = parseQuantity(row.quantity);
  if (row.kind === "kept") return scaleSavedItem(row.item, quantity ?? row.item.quantity);
  const grams = quantity === null ? null : toGrams(quantity, row.unit, row.food);
  return grams === null ? null : nutrientsFor(row.food, grams);
}

const inputClass =
  "min-h-12 rounded-2xl border border-border bg-surface px-4 text-base aria-[invalid]:border-[var(--color-accent)]";

/** Modifier un repas enregistré : son nom, la quantité de chaque aliment, en retirer ou en ajouter. */
export function SavedMealForm({ id, name, items }: { id: string; name: string; items: SavedMealItem[] }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [mealName, setMealName] = useState(name);
  const [rows, setRows] = useState<Row[]>(
    items.map((item, index) => ({ key: `kept-${index}`, kind: "kept", index, item, quantity: String(item.quantity) })),
  );
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading } = useFoodSearch(query);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const values = rows.map(rowNutrients);
  const invalid =
    rows.length === 0 ||
    !mealName.trim() ||
    rows.some((row, position) => parseQuantity(row.quantity) === null || !values[position]);

  const update = (key: string, change: Partial<{ quantity: string; unit: Unit }>) =>
    setRows((current) => current.map((row) => (row.key === key ? ({ ...row, ...change } as Row) : row)));

  const addFood = (food: FoodItem) => {
    const unit = defaultUnit(availableUnits(food));
    setRows((current) => [
      ...current,
      { key: `added-${Date.now()}`, kind: "added", food, unit, quantity: unit === "g" ? "100" : "1" },
    ]);
    setQuery("");
    setSearching(false);
  };

  const submit = () =>
    startTransition(async () => {
      const result = await updateSavedMealAction({
        id,
        name: mealName,
        items: rows.map((row) =>
          row.kind === "kept"
            ? { index: row.index, quantity: parseQuantity(row.quantity)! }
            : { foodId: row.food.id, quantity: parseQuantity(row.quantity)!, unit: row.unit },
        ),
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      toast({ message: t("savedMeals.updated") });
      router.push("/meals");
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <Field
        label={t("savedMeals.nameLabel")}
        value={mealName}
        maxLength={60}
        onChange={(event) => setMealName(event.target.value)}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">{t("savedMeals.itemsLegend")}</legend>
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row, position) => {
            const label = row.kind === "kept" ? row.item.label : row.food.nameFr;
            const kcal = values[position]?.kcal;
            return (
              <li key={row.key} className="flex items-end gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor={`qty-${row.key}`} className="truncate font-semibold" title={label}>
                    {shortFoodName(label)}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`qty-${row.key}`}
                      inputMode="decimal"
                      value={row.quantity}
                      aria-invalid={parseQuantity(row.quantity) === null ? true : undefined}
                      onChange={(event) => update(row.key, { quantity: event.target.value })}
                      className={`w-24 ${inputClass}`}
                    />
                    {row.kind === "kept" ? (
                      <span className="text-text-muted">{t(`units.${row.item.unit}`)}</span>
                    ) : (
                      // Un aliment ajouté se compte dans l'unité de son choix, comme dans le journal.
                      <select
                        aria-label={t("journal.unit")}
                        value={row.unit}
                        onChange={(event) => update(row.key, { unit: event.target.value as Unit })}
                        className={`min-w-0 ${inputClass} px-3`}
                      >
                        {availableUnits(row.food).map((unit) => (
                          <option key={unit} value={unit}>
                            {t(`units.${unit}`)}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="ml-auto shrink-0 text-sm font-semibold">
                      {kcal !== undefined && t("common.kcal", { value: Math.round(kcal) })}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
                  aria-label={t("savedMeals.removeItem", { name: label })}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
                >
                  <Icon name="trash" size={20} />
                </button>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 && <p className="text-text-muted">{t("savedMeals.noItems")}</p>}
        {searching ? (
          <div className="flex flex-col gap-2">
            <label className="focus-within:outline-focus flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface px-4 focus-within:outline-3">
              <span className="text-text-muted">
                <Icon name="search" />
              </span>
              <span className="sr-only">{t("savedMeals.searchLabel")}</span>
              <SearchInput
                value={query}
                onValueChange={setQuery}
                id="saved-meal-search"
                placeholder={t("add.searchHint")}
                autoComplete="off"
              />
            </label>
            {results && results.length > 0 && (
              <div className="max-h-80 overflow-y-auto rounded-2xl border border-border px-3">
                <FoodList foods={results} favoriteIds={new Set()} onSelect={addFood} />
              </div>
            )}
            {results && !loading && results.length === 0 && <p className="text-text-muted">{t("add.noResults")}</p>}
            <Button variant="ghost" onClick={() => (setSearching(false), setQuery(""))} className="self-start">
              {t("savedMeals.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setSearching(true);
              // Le champ de recherche prend le focus dès qu'il apparaît (clavier ouvert sur téléphone).
              requestAnimationFrame(() => document.getElementById("saved-meal-search")?.focus());
            }}
            disabled={rows.length >= 100}
          >
            <Icon name="plus" />
            {t("savedMeals.addFood")}
          </Button>
        )}
      </fieldset>
      <p className="font-semibold">
        {t("savedMeals.total", { kcal: savedMealKcal(values.map((value) => value ?? { kcal: 0 })) })}
      </p>
      <Button type="submit" disabled={pending || invalid}>
        {t("savedMeals.saveChanges")}
      </Button>
    </form>
  );
}
