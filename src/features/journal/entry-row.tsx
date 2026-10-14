"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { shortFoodName } from "@/domain/food-name";
import { useErrorText } from "@/features/auth/use-error-text";
import { ProductThumb } from "@/features/foods/product-thumb";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import type { Unit } from "@/domain/units";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { SwipeRow } from "@/ui/swipe-row";
import { useToast } from "@/ui/toast";

import { deleteEntryAction, updateEntryAction } from "./actions";

export type EntryView = {
  id: string;
  label: string;
  quantity: number;
  unit: Unit;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  slot: MealSlot;
  isEstimated: boolean;
  imageUrl: string | null;
};

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Une ligne du journal, qui se déplie pour modifier la quantité, l'unité ou le repas. */
export function EntryRow({ entry, units, readOnly = false }: { entry: EntryView; units: Unit[]; readOnly?: boolean }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const summary = (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {entry.imageUrl && <ProductThumb src={entry.imageUrl} size={40} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold" title={entry.label}>
          {shortFoodName(entry.label)}
        </span>
        {/* Quantité seulement : les kcal sont à droite, les macros dans le détail de la ligne. */}
        <span className="text-sm text-text-muted">
          {entry.unit === "g"
            ? t("journal.grams", { value: entry.grams })
            : `${entry.quantity} ${t(`units.${entry.unit}`)} · ${t("journal.grams", { value: entry.grams })}`}
          {entry.isEstimated && ` · ${t("journal.estimated")}`}
        </span>
      </span>
    </span>
  );

  // Le détail des macros de l'aliment, affiché quand la ligne est dépliée ou en lecture seule.
  const macros = (
    <span className="flex flex-wrap gap-x-3 text-sm text-text-muted">
      {(
        [
          ["proteinShort", entry.proteinG, "bg-protein"],
          ["carbsShort", entry.carbsG, "bg-carbs"],
          ["fatShort", entry.fatG, "bg-fat"],
        ] as const
      ).map(([key, value, color]) => (
        <span key={key} className="flex items-center gap-1">
          <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
          {t(`home.${key}`)} {t("journal.grams", { value: Math.round(value) })}
        </span>
      ))}
    </span>
  );

  if (readOnly)
    return (
      <div className="flex flex-col gap-1 py-2">
        <div className="flex items-center gap-3">
          {summary}
          <span className="font-semibold">{t("common.kcal", { value: Math.round(entry.kcal) })}</span>
        </div>
        {macros}
      </div>
    );

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateEntryAction({
        id: entry.id,
        quantity: Number(String(formData.get("quantity")).replace(",", ".")),
        unit: formData.get("unit") as Unit,
        slot: formData.get("slot") as MealSlot,
      });
      if (result?.error) setError(result.error);
      else setOpen(false);
    });

  // La ligne disparaît tout de suite ; la suppression n'est faite qu'à la fin du délai d'annulation.
  const remove = () => {
    setHidden(true);
    toast({
      message: t("journal.deleted", { label: entry.label }),
      undo: () => setHidden(false),
      onExpire: () =>
        void deleteEntryAction(entry.id).then((result) => {
          if (!result?.error) return;
          setHidden(false);
          setError(result.error);
        }),
    });
  };

  if (hidden) return null;

  return (
    <div className="flex flex-col gap-3 py-2">
      <SwipeRow
        onSwipeLeft={remove}
        onSwipeRight={() => setOpen(true)}
        leftLabel={t("journal.delete")}
        rightLabel={t("journal.swipeEdit")}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={t("journal.edit", { label: entry.label })}
          className="flex min-h-12 w-full items-center gap-3 text-left"
        >
          {summary}
          <span className="font-semibold">{t("common.kcal", { value: Math.round(entry.kcal) })}</span>
        </button>
      </SwipeRow>
      {open && (
        <form action={save} className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-3">
          {error && <Alert>{errorText(error)}</Alert>}
          {macros}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("journal.quantity")}</span>
              <input
                name="quantity"
                inputMode="decimal"
                defaultValue={entry.quantity}
                required
                className={selectClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("journal.unit")}</span>
              <select name="unit" defaultValue={entry.unit} className={selectClass}>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`units.${unit}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("journal.slot")}</span>
            <select name="slot" defaultValue={entry.slot} className={selectClass}>
              {MEAL_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {t(`slots.${slot}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {t("journal.save")}
            </Button>
            <Button variant="ghost" onClick={remove} disabled={pending}>
              <Icon name="trash" />
              {t("journal.delete")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
