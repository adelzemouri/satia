"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { addPlanItemAction } from "./actions";

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";
const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const satisfies readonly MealSlot[];

type RecipeOption = { id: string; name: string };

/**
 * Ajout d'un plat au menu : un jour, un repas, une recette (du foyer ou du catalogue Pommelia)
 * ou un nom libre. Depuis une
 * case du tableau de la semaine (ordinateur), le jour et le repas sont déjà choisis (`fixed`).
 */
export function AddPlanItemForm({
  days,
  recipes,
  catalogRecipes,
  defaultDate,
  fixed,
  onDone,
}: {
  days: { date: string; label: string }[];
  defaultDate: string;
  /** Recettes du foyer. */
  recipes: RecipeOption[];
  /** Recettes du catalogue Pommelia, communes à tous. */
  catalogRecipes: RecipeOption[];
  fixed?: { date: string; slot: MealSlot };
  onDone?: () => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [foodId, setFoodId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await addPlanItemAction({
            date: String(formData.get("date")),
            slot: String(formData.get("slot")) as MealSlot,
            foodId: foodId || null,
            label: foodId ? "" : String(formData.get("label") ?? ""),
            servings: Number(formData.get("servings")),
          });
          setError(result?.error ?? null);
          if (!result?.error) {
            setFoodId("");
            onDone?.();
          }
        })
      }
      className="flex flex-col gap-3"
    >
      {fixed ? (
        <>
          <input type="hidden" name="date" value={fixed.date} />
          <input type="hidden" name="slot" value={fixed.slot} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("plan.day")}</span>
            <select name="date" className={selectClass} defaultValue={defaultDate}>
              {days.map((day) => (
                <option key={day.date} value={day.date}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("plan.slot")}</span>
            <select name="slot" className={selectClass} defaultValue="dinner">
              {SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {t(`slots.${slot}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("plan.recipe")}</span>
        <select value={foodId} onChange={(event) => setFoodId(event.target.value)} className={selectClass}>
          <option value="">{t("plan.recipeNone")}</option>
          {recipes.length > 0 && (
            <optgroup label={t("plan.householdRecipes")}>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </optgroup>
          )}
          {catalogRecipes.length > 0 && (
            <optgroup label={t("plan.catalogRecipes")}>
              {catalogRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {recipes.length + catalogRecipes.length === 0 && <p className="text-sm text-text-muted">{t("plan.noRecipes")}</p>}
      {!foodId && <Field label={t("plan.label")} hint={t("plan.labelHint")} name="label" maxLength={80} required />}
      <Field
        label={t("plan.servingsLabel")}
        name="servings"
        type="number"
        min={0.5}
        max={20}
        step={0.5}
        defaultValue={4}
        required
      />
      {error && <Alert>{errorText(error)}</Alert>}
      <Button type="submit" disabled={pending}>
        {t("plan.add")}
      </Button>
    </form>
  );
}
