"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useState, useTransition } from "react";

import { analyzePhotoAction } from "@/features/ai/actions";
import { compressImage } from "@/features/ai/compress-image";
import { useErrorText } from "@/features/auth/use-error-text";
import { createRecipeAction, updateRecipeAction } from "@/features/journal/actions";
import { nutrientsFor, sumNutrients } from "@/domain/nutrition";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";

import { readNumber } from "./custom-food-form";
import { FoodList } from "./food-list";
import type { FoodItem } from "./food-types";
import { useFoodSearch } from "./use-food-search";

type Ingredient = { food: FoodItem; grams: string };

export type RecipeFormInitial = {
  id: string;
  name: string;
  servings: number;
  cookedGrams: number | null;
  family: boolean;
  items: { food: FoodItem; grams: number }[];
  steps: string[];
};

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Création ou modification d'une recette. Une recette « du foyer » est visible et modifiable
 * par tous les membres ; les ingrédients peuvent être pré-remplis depuis une photo (IA).
 */
export function RecipeForm({
  initial,
  familyOnly = false,
  defaultFamily = false,
  aiAvailable = false,
  onSaved,
}: {
  initial?: RecipeFormInitial;
  /** Recette forcément commune (création depuis un repas partagé). */
  familyOnly?: boolean;
  defaultFamily?: boolean;
  aiAvailable?: boolean;
  /** Sans ce rappel, on revient à la liste des aliments après l'enregistrement. */
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [items, setItems] = useState<Ingredient[]>(
    () => initial?.items.map((item) => ({ food: item.food, grams: String(item.grams) })) ?? [],
  );
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [family, setFamily] = useState(familyOnly || (initial?.family ?? defaultFamily));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const { results } = useFoodSearch(query);

  const totals = sumNutrients(items.map((item) => nutrientsFor(item.food, Number(item.grams.replace(",", ".")) || 0)));
  const perServing = Math.round(totals.kcal / Math.max(1, Number(servings) || 1));

  const [moved, setMoved] = useState("");
  /** Échange un ingrédient avec son voisin ; l'ordre de la liste est celui de la recette. */
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    setMoved(t("foods.ingredientMoved", { name: next[target]!.food.nameFr, position: target + 1, total: next.length }));
  };

  const addIngredients = (added: Ingredient[]) =>
    setItems((list) => [...list, ...added.filter((item) => !list.some((other) => other.food.id === item.food.id))]);

  const fillFromPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    startTransition(async () => {
      setError(null);
      try {
        const image = await compressImage(file);
        const result = await analyzePhotoAction({ imageBase64: await toBase64(image.blob), mime: image.mime });
        if ("error" in result) return setError(result.error);
        addIngredients(
          result.draft.items.flatMap((item) => (item.food ? [{ food: item.food, grams: String(item.quantity) }] : [])),
        );
        setNotFound(result.draft.items.filter((item) => !item.food).map((item) => item.label));
      } catch {
        setError("photo_unreadable");
      }
    });
  };

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const input = {
        name: String(formData.get("name") ?? ""),
        servings: Number(servings),
        cookedGrams: readNumber(formData, "cookedGrams"),
        items: items.map((item) => ({ foodId: item.food.id, grams: Number(item.grams.replace(",", ".")) })),
        family,
        // Une étape par ligne ; les lignes vides sont ignorées.
        steps: String(formData.get("steps") ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };
      const result = initial ? await updateRecipeAction(initial.id, input) : await createRecipeAction(input);
      if (result?.error) return setError(result.fieldErrors?.items ?? result.fieldErrors?.name ?? result.error);
      const id = initial?.id ?? (result as { id?: string } | null)?.id;
      if (onSaved && id) onSaved(id);
      else router.push(family ? "/recipes" : "/foods");
    });

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error) ?? errorText("generic")}</Alert>}
      <Field label={t("foods.name")} name="name" required maxLength={120} defaultValue={initial?.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("foods.servings")}
          name="servings"
          inputMode="numeric"
          value={servings}
          onChange={(event) => setServings(event.target.value)}
          required
        />
        <Field
          label={t("foods.cookedGrams")}
          hint={t("foods.cookedHint")}
          name="cookedGrams"
          inputMode="decimal"
          defaultValue={initial?.cookedGrams ?? undefined}
        />
      </div>
      {!familyOnly && !initial?.family && (
        <div className="flex flex-col gap-1">
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              checked={family}
              onChange={(event) => setFamily(event.target.checked)}
              aria-describedby="family-recipe-hint"
              className="size-5 accent-primary"
            />
            {t("foods.familyRecipe")}
          </label>
          <p id="family-recipe-hint" className="text-sm text-text-muted">
            {t("foods.familyRecipeHint")}
          </p>
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-lg font-semibold">{t("foods.ingredients")}</legend>
        {aiAvailable && (
          <label className={buttonClass("secondary", "cursor-pointer focus-within:outline-2")}>
            <Icon name="camera" />
            {pending ? t("aiEntry.analyzing") : t("foods.fromPhoto")}
            <input type="file" accept="image/*" onChange={fillFromPhoto} disabled={pending} className="sr-only" />
          </label>
        )}
        {notFound.length > 0 && (
          <p className="text-sm text-text-muted">{t("foods.photoNotFound", { names: notFound.join(", ") })}</p>
        )}
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
              <div className="flex">
                <button
                  type="button"
                  aria-label={t("foods.moveUp", { name: item.food.nameFr })}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted disabled:opacity-30"
                >
                  <Icon name="up" />
                </button>
                <button
                  type="button"
                  aria-label={t("foods.moveDown", { name: item.food.nameFr })}
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted disabled:opacity-30"
                >
                  <Icon name="down" />
                </button>
              </div>
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
        <p className="sr-only" aria-live="polite">
          {moved}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("foods.addIngredient")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
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
              addIngredients([{ food, grams: "100" }]);
              setQuery("");
            }}
          />
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">{t("foods.steps")}</span>
        <span id="steps-hint" className="text-sm text-text-muted">
          {t("foods.stepsHint")}
        </span>
        <textarea
          name="steps"
          rows={5}
          maxLength={6000}
          defaultValue={initial?.steps.join("\n")}
          aria-describedby="steps-hint"
          className="rounded-2xl border border-border bg-surface px-3 py-2 text-base"
        />
      </label>

      {items.length > 0 && (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 font-semibold" aria-live="polite">
          {t("foods.recipeSummary", { kcal: perServing })}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {initial ? t("common.save") : t("foods.create")}
      </Button>
    </form>
  );
}
