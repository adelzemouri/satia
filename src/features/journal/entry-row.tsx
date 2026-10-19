"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

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

import { deleteEntryAction, setFavoriteAction, updateEntryAction } from "./actions";

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
  /** Aliment de la base derrière la ligne ; sans lui (valeurs estimées seules), pas de favori possible. */
  foodId: string | null;
  favorite: boolean;
};

/** Resserrement de la liste quand une ligne est supprimée. */
const COLLAPSE_MS = 200;

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Une ligne du journal, qui se déplie pour modifier la quantité, l'unité ou le repas. */
export function EntryRow({
  entry,
  units,
  readOnly = false,
  muted = false,
}: {
  entry: EntryView;
  units: Unit[];
  readOnly?: boolean;
  /** Ligne d'un plat, posée sur le fond gris de son encadré. */
  muted?: boolean;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  // La ligne se resserre avant de disparaître ; « Annuler » la remet (et remonte la ligne glissée).
  const [collapsing, setCollapsing] = useState(false);
  const [restored, setRestored] = useState(0);
  const collapseTimer = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [favorite, setFavorite] = useState(entry.favorite);

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

  // L'étoile change tout de suite ; elle revient en arrière si l'enregistrement échoue.
  const toggleFavorite = () => {
    const foodId = entry.foodId;
    if (!foodId) return;
    const next = !favorite;
    setFavorite(next);
    void setFavoriteAction(foodId, next).then((result) => {
      if (result?.error) {
        setFavorite(!next);
        setError(result.error);
      } else {
        toast({ message: t(next ? "journal.favoriteAdded" : "journal.favoriteRemoved", { label: entry.label }) });
      }
    });
  };

  const restore = () => {
    window.clearTimeout(collapseTimer.current);
    setCollapsing(false);
    setHidden(false);
    setRestored((count) => count + 1);
  };

  // La ligne se resserre puis disparaît ; la suppression n'est faite qu'à la fin du délai d'annulation.
  const remove = () => {
    setCollapsing(true);
    collapseTimer.current = window.setTimeout(() => setHidden(true), COLLAPSE_MS);
    toast({
      message: t("journal.deleted", { label: entry.label }),
      undo: restore,
      onExpire: () =>
        void deleteEntryAction(entry.id).then((result) => {
          if (!result?.error) return;
          restore();
          setError(result.error);
        }),
    });
  };

  if (hidden) return null;

  return (
    <div
      className={`grid grid-cols-1 transition-[grid-template-rows,opacity] ease-out-strong ${
        collapsing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
      }`}
      style={{ transitionDuration: `${COLLAPSE_MS}ms` }}
    >
      <div className={`flex min-h-0 min-w-0 flex-col gap-3 py-2 ${collapsing ? "overflow-hidden" : ""}`}>
        <SwipeRow key={restored} onSwipeLeft={remove} leftLabel={t("journal.delete")} muted={muted}>
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
          <form
            action={save}
            className={`flex flex-col gap-3 rounded-2xl p-3 ${muted ? "bg-surface" : "bg-surface-muted"}`}
          >
            {error && <Alert>{errorText(error)}</Alert>}
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{macros}</div>
              {/* L'étoile, comme dans les listes d'aliments, en face des macros. */}
              {entry.foodId && (
                <button
                  type="button"
                  onClick={toggleFavorite}
                  aria-pressed={favorite}
                  aria-label={t(favorite ? "journal.favoriteRemove" : "journal.favoriteAdd", { label: entry.label })}
                  className={`-my-2 -mr-1 flex size-12 shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] ${
                    favorite ? "text-carbs" : "text-text-muted"
                  }`}
                >
                  <Icon name="star" filled={favorite} />
                </button>
              )}
            </div>
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
    </div>
  );
}
