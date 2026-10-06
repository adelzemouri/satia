"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { shortFoodName } from "@/domain/food-name";
import type { SavedMealItem } from "@/db/schema";
import { savedMealKcal, scaleSavedItem } from "@/domain/saved-meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";

import { updateSavedMealAction } from "./actions";

type Row = { index: number; item: SavedMealItem; quantity: string };

function parseQuantity(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Modifier un repas enregistré : son nom, la quantité de chaque aliment, ou en retirer. */
export function SavedMealForm({ id, name, items }: { id: string; name: string; items: SavedMealItem[] }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [mealName, setMealName] = useState(name);
  const [rows, setRows] = useState<Row[]>(
    items.map((item, index) => ({ index, item, quantity: String(item.quantity) })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scaled = rows.map((row) => scaleSavedItem(row.item, parseQuantity(row.quantity) ?? row.item.quantity));
  const invalid = rows.length === 0 || !mealName.trim() || rows.some((row) => parseQuantity(row.quantity) === null);

  const submit = () =>
    startTransition(async () => {
      const result = await updateSavedMealAction({
        id,
        name: mealName,
        items: rows.map((row) => ({ index: row.index, quantity: parseQuantity(row.quantity)! })),
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
          {rows.map((row, position) => (
            <li key={row.index} className="flex items-end gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor={`qty-${row.index}`} className="font-semibold">
                  {shortFoodName(row.item.label)}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`qty-${row.index}`}
                    inputMode="decimal"
                    value={row.quantity}
                    aria-invalid={parseQuantity(row.quantity) === null ? true : undefined}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((other) =>
                          other.index === row.index ? { ...other, quantity: event.target.value } : other,
                        ),
                      )
                    }
                    className="min-h-12 w-24 rounded-2xl border border-border bg-surface px-4 text-base aria-[invalid]:border-[var(--color-accent)]"
                  />
                  <span className="text-text-muted">{t(`units.${row.item.unit}`)}</span>
                  <span className="ml-auto text-sm font-semibold">
                    {t("common.kcal", { value: Math.round(scaled[position]!.kcal) })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((other) => other.index !== row.index))}
                aria-label={t("savedMeals.removeItem", { name: row.item.label })}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
              >
                <Icon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="text-text-muted">{t("savedMeals.noItems")}</p>}
      </fieldset>
      <p className="font-semibold">{t("savedMeals.total", { kcal: savedMealKcal(scaled) })}</p>
      <Button type="submit" disabled={pending || invalid}>
        {t("savedMeals.saveChanges")}
      </Button>
    </form>
  );
}
