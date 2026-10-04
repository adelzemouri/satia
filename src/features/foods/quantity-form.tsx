"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { addEntryAction, deleteEntryAction, setUnitWeightAction } from "@/features/journal/actions";
import { isNetworkFailure } from "@/features/offline/pending-queue";
import { useOfflineQueue } from "@/features/offline/offline-provider";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { nutrientsFor } from "@/domain/nutrition";
import { availableUnits, type CountUnit, stepQuantity, toGrams, type Unit } from "@/domain/units";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { defaultUnit, type FoodItem } from "./food-types";
import { ProductThumb } from "./product-thumb";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Choix de la quantité, de l'unité et du repas, avec l'aperçu des calories. */
export function QuantityForm({
  food,
  date,
  slot: initialSlot,
  inputMethod = "manual",
  onCancel,
}: {
  food: FoodItem;
  date: string;
  slot: MealSlot;
  inputMethod?: "manual" | "barcode";
  onCancel: () => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  // Les poids d'unité peuvent être complétés ici (une tranche…), sans recharger l'aliment.
  const [weights, setWeights] = useState(food.unitWeights);
  const units = availableUnits({ ...food, unitWeights: weights });
  const [unit, setUnit] = useState<Unit>(defaultUnit(units));
  const [quantity, setQuantity] = useState(unit === "g" ? "100" : "1");
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [pending, startTransition] = useTransition();
  const offline = useOfflineQueue();
  const toast = useToast();
  const locale = useLocale();
  // Les boutons − et + écrivent la quantité avec la virgule en français.
  const step = (direction: 1 | -1) => {
    const next = stepQuantity(amount, unit, direction);
    setQuantity(locale === "fr" ? next.replace(".", ",") : next);
  };

  const amount = Number(quantity.replace(",", "."));
  const grams = toGrams(amount, unit, { ...food, unitWeights: weights });
  const preview = grams === null ? null : nutrientsFor(food, grams);

  const changeUnit = (next: Unit) => {
    setUnit(next);
    if (next === "g" || next === "ml") setQuantity("100");
    else if (unit === "g" || unit === "ml") setQuantity("1");
  };

  const submit = () =>
    startTransition(async () => {
      const input = { date, slot, foodId: food.id, quantity: amount, unit, inputMethod };
      // Sans réseau, l'aliment attend sur le téléphone et part dès que la connexion revient.
      const queue = () => {
        offline!.queue({ ...input, label: food.nameFr, kcal: Math.round(preview?.kcal ?? 0) });
        setQueued(true);
      };
      if (offline && !navigator.onLine) return queue();
      try {
        const result = await addEntryAction(input);
        if (result?.error) return setError(result.error);
        haptic();
        const id = result?.id;
        toast({
          message: t("add.addedTo", { name: food.nameFr, slot: t(`slotsLower.${slot}`) }),
          undo: id ? () => void deleteEntryAction(id) : undefined,
        });
        router.push({ pathname: "/journal", query: { date } });
      } catch (failure) {
        if (offline && isNetworkFailure(failure)) queue();
        else setError("generic");
      }
    });

  if (queued) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t("offline.queued", { name: food.nameFr })}</Alert>
        <Button variant="secondary" onClick={onCancel}>
          {t("offline.addAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4" aria-labelledby="quantity-title">
      <div className="flex flex-col gap-1">
        <h2 id="quantity-title" className="text-xl font-semibold">
          {t("add.quantityTitle")}
        </h2>
        <div className="flex items-center gap-3">
          {food.imageUrl && <ProductThumb src={food.imageUrl} size={64} />}
          <p className="font-semibold">
            {food.nameFr}
            {food.brand && <span className="font-normal text-text-muted"> · {food.brand}</span>}
          </p>
        </div>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quantity-input" className="font-semibold">
            {t("journal.quantity")}
          </label>
          <span className="flex items-center gap-1">
            <StepButton label={t("add.less")} icon="minus" onClick={() => step(-1)} />
            <input
              id="quantity-input"
              name="quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
              className={`${inputClass} w-full min-w-0 text-center`}
            />
            <StepButton label={t("add.more")} icon="plus" onClick={() => step(1)} />
          </span>
        </div>
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
      {food.source !== "recipe" && !weights?.slice && !weights?.piece && (
        <UnitWeightForm
          foodId={food.id}
          onSaved={(countUnit, value) => {
            setWeights({ ...weights, [countUnit]: value });
            setUnit(countUnit);
            setQuantity("1");
          }}
        />
      )}
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

function StepButton({ label, icon, onClick }: { label: string; icon: "minus" | "plus"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text hover:bg-surface-muted"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/**
 * Pour un produit sans poids de tranche ou de pièce : on l'indique une fois (il est souvent écrit
 * sur l'emballage), puis on saisit « 2 tranches » au lieu de peser.
 */
function UnitWeightForm({ foodId, onSaved }: { foodId: string; onSaved: (unit: CountUnit, grams: number) => void }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<CountUnit>("slice");
  const [grams, setGrams] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const value = Number(grams.replace(",", "."));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-left font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t("add.unitWeightOpen")}
      </button>
    );
  }

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await setUnitWeightAction({ foodId, unit, grams: value });
      if (result?.error) setError(result.error);
      else onSaved(unit, Math.round(value * 10) / 10);
    });

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-4">
      <legend className="sr-only">{t("add.unitWeightTitle")}</legend>
      <p className="font-semibold">{t("add.unitWeightTitle")}</p>
      <p className="text-sm text-text-muted">{t("add.unitWeightHint")}</p>
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("add.unitWeightUnit")}</span>
          <select value={unit} onChange={(event) => setUnit(event.target.value as CountUnit)} className={inputClass}>
            {(["slice", "piece", "portion"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`units.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("add.unitWeightGrams")}</span>
          <input
            inputMode="decimal"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <Button variant="secondary" onClick={save} disabled={pending || !(value > 0 && value <= 2000)}>
        {t("add.unitWeightSave")}
      </Button>
    </fieldset>
  );
}
