"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { createRecipeAction } from "@/features/journal/actions";
import { nutrientsFor, sumNutrients } from "@/domain/nutrition";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";

import { readNumber } from "./custom-food-form";
import { FoodList } from "./food-list";
import type { FoodItem } from "./food-types";
import { useFoodSearch } from "./use-food-search";

type Ingredient = { food: FoodItem; grams: string };

export function RecipeForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [servings, setServings] = useState("4");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { results } = useFoodSearch(query);

  const totals = sumNutrients(items.map((item) => nutrientsFor(item.food, Number(item.grams.replace(",", ".")) || 0)));
  const perServing = Math.round(totals.kcal / Math.max(1, Number(servings) || 1));

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await createRecipeAction({
        name: String(formData.get("name") ?? ""),
        servings: Number(servings),
        cookedGrams: readNumber(formData, "cookedGrams"),
        items: items.map((item) => ({ foodId: item.food.id, grams: Number(item.grams.replace(",", ".")) })),
      });
      if (result?.error) setError(result.fieldErrors?.items ?? result.fieldErrors?.name ?? result.error);
      else router.push("/foods");
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error) ?? errorText("generic")}</Alert>}
      <Field label={t("foods.name")} name="name" required maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("foods.servings")}
          name="servings"
          inputMode="numeric"
          value={servings}
          onChange={(event) => setServings(event.target.value)}
          required
        />
        <Field label={t("foods.cookedGrams")} hint={t("foods.cookedHint")} name="cookedGrams" inputMode="decimal" />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-lg font-semibold">{t("foods.ingredients")}</legend>
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item.food.id} className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-sm font-semibold">{item.food.nameFr}</span>
                <span className="sr-only">{t("foods.ingredientGrams", { name: item.food.nameFr })}</span>
                <span className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    value={item.grams}
                    onChange={(event) =>
                      setItems((list) =>
                        list.map((other, i) => (i === index ? { ...other, grams: event.target.value } : other)),
                      )
                    }
                    className="min-h-12 w-28 rounded-2xl border border-border bg-surface px-3 text-base"
                  />
                  g
                </span>
              </label>
              <button
                type="button"
                aria-label={t("foods.removeIngredient", { name: item.food.nameFr })}
                onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
                className="flex size-12 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("foods.addIngredient")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("add.searchHint")}
            autoComplete="off"
            className="min-h-12 rounded-2xl border border-border bg-surface px-4 text-base"
          />
        </label>
        {results && results.length > 0 && (
          <FoodList
            foods={results.filter((food) => !items.some((item) => item.food.id === food.id)).slice(0, 8)}
            favoriteIds={new Set()}
            onSelect={(food) => {
              setItems((list) => [...list, { food, grams: "100" }]);
              setQuery("");
            }}
          />
        )}
      </fieldset>

      {items.length > 0 && (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 font-semibold" aria-live="polite">
          {t("foods.recipeSummary", { kcal: perServing })}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("foods.create")}
      </Button>
    </form>
  );
}
