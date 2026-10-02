"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { addEntryAction } from "@/features/journal/actions";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { nutrientsFor } from "@/domain/nutrition";
import { availableUnits, toGrams, type Unit } from "@/domain/units";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { defaultUnit, type FoodItem } from "./food-types";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Choix de la quantité, de l'unité et du repas, avec l'aperçu des calories. */
export function QuantityForm({
  food,
  date,
  slot: initialSlot,
  onCancel,
}: {
  food: FoodItem;
  date: string;
  slot: MealSlot;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const units = availableUnits(food);
  const [unit, setUnit] = useState<Unit>(defaultUnit(units));
  const [quantity, setQuantity] = useState(unit === "g" ? "100" : "1");
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amount = Number(quantity.replace(",", "."));
  const grams = toGrams(amount, unit, food);
  const preview = grams === null ? null : nutrientsFor(food, grams);

  const changeUnit = (next: Unit) => {
    setUnit(next);
    if (next === "g" || next === "ml") setQuantity("100");
    else if (unit === "g" || unit === "ml") setQuantity("1");
  };

  const submit = () =>
    startTransition(async () => {
      const result = await addEntryAction({ date, slot, foodId: food.id, quantity: amount, unit });
      if (result?.error) setError(result.error);
      else router.push({ pathname: "/journal", query: { date } });
    });

  return (
    <form action={submit} className="flex flex-col gap-4" aria-labelledby="quantity-title">
      <div className="flex flex-col gap-1">
        <h2 id="quantity-title" className="text-xl font-semibold">
          {t("add.quantityTitle")}
        </h2>
        <p className="font-semibold">
          {food.nameFr}
          {food.brand && <span className="font-normal text-text-muted"> · {food.brand}</span>}
        </p>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("journal.quantity")}</span>
          <input
            name="quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("journal.unit")}</span>
          <select
            name="unit"
            value={unit}
            onChange={(event) => changeUnit(event.target.value as Unit)}
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
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("journal.slot")}</span>
        <select
          name="slot"
          value={slot}
          onChange={(event) => setSlot(event.target.value as MealSlot)}
          className={inputClass}
        >
          {MEAL_SLOTS.map((value) => (
            <option key={value} value={value}>
              {t(`slots.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-2xl bg-surface-muted px-4 py-3 font-semibold" aria-live="polite">
        {preview ? t("add.preview", { kcal: Math.round(preview.kcal) }) : "—"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || grams === null}>
          {t("add.addButton")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("add.changeFood")}
        </Button>
      </div>
    </form>
  );
}
