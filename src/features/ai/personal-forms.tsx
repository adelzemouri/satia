"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { CONTAINER_KINDS, type ContainerKind } from "@/db/schema/meal-ai";
import { useErrorText } from "@/features/auth/use-error-text";
import { FoodSearchBox } from "@/features/foods/food-search-box";
import { defaultUnit, type FoodItem } from "@/features/foods/food-types";
import { availableUnits, type Unit } from "@/domain/units";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { createContainerAction, deleteContainerAction, deleteExpressionAction, saveExpressionAction } from "./actions";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

function toNumber(value: string): number | null {
  const number = Number(value.replace(",", ".").trim());
  return value.trim() === "" || !Number.isFinite(number) ? null : number;
}

/** Bouton de suppression d'une ligne (contenant ou expression). */
export function RemoveButton({ kind, id, name }: { kind: "container" | "expression"; id: string; name: string }) {
  const t = useTranslations("personal");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label={t("remove", { name })}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await (kind === "container" ? deleteContainerAction(id) : deleteExpressionAction(id));
            setError(result?.error ?? null);
          })
        }
        className="flex size-12 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
      >
        <Icon name="trash" />
      </button>
      {error && (
        <div className="basis-full">
          <Alert>{errorText(error)}</Alert>
        </div>
      )}
    </>
  );
}

/** Ajout d'un contenant : nom, type, et volume ou diamètre. */
export function ContainerForm() {
  const t = useTranslations("personal");
  const errorText = useErrorText();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ContainerKind>("bowl");
  const [volume, setVolume] = useState("");
  const [diameter, setDiameter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await createContainerAction({
        name,
        kind,
        volumeMl: toNumber(volume),
        diameterCm: toNumber(diameter),
      });
      if (result?.error) {
        const field = result.fieldErrors && Object.values(result.fieldErrors)[0];
        return setError(field && field !== "required" ? field : result.error);
      }
      setError(null);
      setName("");
      setVolume("");
      setDiameter("");
    });

  return (
    <form action={submit} className="flex flex-col gap-3" aria-labelledby="container-form-title">
      <h2 id="container-form-title" className="font-semibold">
        {t("addContainer")}
      </h2>
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("containerName")}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            placeholder={t("containerNameHint")}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("containerKind")}</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as ContainerKind)}
            className={inputClass}
          >
            {CONTAINER_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kinds.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("volume")}</span>
          <input
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("diameter")}</span>
          <input
            value={diameter}
            onChange={(event) => setDiameter(event.target.value)}
            inputMode="decimal"
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-sm text-text-muted">{t("sizeHint")}</p>
      <Button type="submit" disabled={pending} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

/** Ajout d'une expression du dictionnaire : la phrase, l'aliment, la quantité. */
export function ExpressionForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [phrase, setPhrase] = useState("");
  const [food, setFood] = useState<FoodItem | null>(null);
  const [unit, setUnit] = useState<Unit>("g");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chooseFood = (value: FoodItem) => {
    const next = defaultUnit(availableUnits(value));
    setFood(value);
    setUnit(next);
    setQuantity(next === "g" ? "100" : "1");
  };

  const submit = () =>
    startTransition(async () => {
      if (!food) return;
      const result = await saveExpressionAction({
        phrase,
        foodId: food.id,
        quantity: toNumber(quantity) ?? 0,
        unit,
      });
      if (result?.error) return setError(result.error);
      setError(null);
      setPhrase("");
      setFood(null);
    });

  return (
    <form action={submit} className="flex flex-col gap-3" aria-labelledby="expression-form-title">
      <h2 id="expression-form-title" className="font-semibold">
        {t("personal.addExpression")}
      </h2>
      {error && <Alert>{errorText(error)}</Alert>}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("personal.phrase")}</span>
        <input
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          required
          maxLength={60}
          placeholder={t("personal.phraseHint")}
          className={inputClass}
        />
      </label>
      {food ? (
        <>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-muted px-4 py-2">
            <span className="font-semibold">{food.nameFr}</span>
            <Button variant="ghost" className="px-3" onClick={() => setFood(null)}>
              {t("personal.otherFood")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("journal.quantity")}</span>
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("journal.unit")}</span>
              <select value={unit} onChange={(event) => setUnit(event.target.value as Unit)} className={inputClass}>
                {availableUnits(food).map((value) => (
                  <option key={value} value={value}>
                    {t(`units.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            {t("personal.save")}
          </Button>
        </>
      ) : (
        <FoodSearchBox label={t("personal.food")} onSelect={chooseFood} />
      )}
    </form>
  );
}
