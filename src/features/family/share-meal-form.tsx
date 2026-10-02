"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { FoodSearchBox } from "@/features/foods/food-search-box";
import type { FoodItem } from "@/features/foods/food-types";
import { RecipeForm } from "@/features/foods/recipe-form";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { portionLabel } from "@/domain/portions";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { createSharedMealAction, getFoodItemAction } from "./actions";

const MY_PORTIONS = [0, 0.5, 1, 1.5, 2] as const;
const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

function toNumber(value: string): number {
  return Number(value.replace(",", ".").trim());
}

/** Poids du plat entier quand on le connaît : une portion de recette × son nombre de portions. */
function dishGrams(food: FoodItem): number | null {
  const portion = food.unitWeights?.portion;
  return portion && food.servings ? Math.round(portion * food.servings) : null;
}

/**
 * Partage d'un plat préparé pour plusieurs : choix du plat (recette du foyer, ou nouveau plat
 * saisi par ingrédients ou par photo), nombre de parts, membres concernés et sa propre portion.
 */
export function ShareMealForm({
  date,
  slot: initialSlot,
  members,
  recipes,
  aiAvailable,
  initialDish = null,
}: {
  date: string;
  slot: MealSlot;
  members: { id: string; name: string }[];
  recipes: FoodItem[];
  aiAvailable: boolean;
  /** Plat déjà choisi (depuis la fiche d'une recette). */
  initialDish?: FoodItem | null;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const [dish, setDish] = useState<FoodItem | null>(initialDish);
  const [creating, setCreating] = useState(false);
  const [totalParts, setTotalParts] = useState(String(initialDish?.servings ?? 4));
  const [totalGrams, setTotalGrams] = useState(String((initialDish && dishGrams(initialDish)) ?? ""));
  const [memberIds, setMemberIds] = useState<string[]>(() => members.map((member) => member.id));
  const [myParts, setMyParts] = useState<number>(1);
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chooseDish = (food: FoodItem) => {
    setDish(food);
    setCreating(false);
    setTotalParts(String(food.servings ?? 4));
    setTotalGrams(String(dishGrams(food) ?? ""));
  };

  const recipeCreated = (id: string) =>
    startTransition(async () => {
      const result = await getFoodItemAction(id);
      if ("error" in result) setError(result.error);
      else chooseDish(result.food);
    });

  const parts = toNumber(totalParts);
  const grams = toNumber(totalGrams);
  const partGrams = parts > 0 && grams > 0 ? grams / parts : null;
  const partKcal = dish && partGrams ? Math.round((dish.kcal * partGrams) / 100) : null;

  const submit = () =>
    startTransition(async () => {
      if (!dish) return;
      setError(null);
      const result = await createSharedMealAction({
        foodId: dish.id,
        date,
        slot,
        totalParts: parts,
        totalGrams: grams > 0 ? grams : null,
        memberIds,
        myParts: myParts > 0 ? myParts : null,
      });
      if (result?.error) setError(result.error);
      else router.push({ pathname: "/journal", query: { date } });
    });

  if (!dish) {
    return (
      <div className="flex flex-col gap-4">
        {error && <Alert>{errorText(error)}</Alert>}
        {creating ? (
          <>
            <RecipeForm familyOnly aiAvailable={aiAvailable} onSaved={recipeCreated} />
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <>
            <FoodSearchBox label={t("family.chooseDish")} suggestions={recipes} onSelect={chooseDish} />
            <Button variant="secondary" onClick={() => setCreating(true)}>
              {t("family.newDish")}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4" aria-labelledby="share-dish">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-muted px-4 py-2">
        <h2 id="share-dish" className="font-semibold">
          {dish.nameFr}
        </h2>
        <Button variant="ghost" className="px-3" onClick={() => setDish(null)}>
          {t("family.otherDish")}
        </Button>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("family.totalParts")}</span>
          <input
            value={totalParts}
            onChange={(event) => setTotalParts(event.target.value)}
            inputMode="decimal"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("family.totalGrams")}</span>
          <input
            value={totalGrams}
            onChange={(event) => setTotalGrams(event.target.value)}
            inputMode="decimal"
            required
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-sm text-text-muted" aria-live="polite">
        {partGrams && partKcal !== null
          ? t("family.partPreview", { grams: Math.round(partGrams), kcal: partKcal })
          : t("family.weightHint")}
      </p>

      {members.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-semibold">{t("family.who")}</legend>
          {members.map((member) => (
            <label key={member.id} className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={memberIds.includes(member.id)}
                onChange={(event) =>
                  setMemberIds((list) =>
                    event.target.checked ? [...list, member.id] : list.filter((id) => id !== member.id),
                  )
                }
                className="size-5 accent-primary"
              />
              {member.name}
            </label>
          ))}
          <p className="text-sm text-text-muted">{t("family.whoHint")}</p>
        </fieldset>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("family.myPortion")}</span>
        <select value={myParts} onChange={(event) => setMyParts(Number(event.target.value))} className={inputClass}>
          {MY_PORTIONS.map((value) => (
            <option key={value} value={value}>
              {value === 0 ? t("family.notEating") : t("family.parts", { value: portionLabel(value), count: value })}
            </option>
          ))}
        </select>
      </label>
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
      <Button type="submit" disabled={pending || !partGrams}>
        {t("family.share")}
      </Button>
    </form>
  );
}
