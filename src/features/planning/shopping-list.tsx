"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { AISLES, type Aisle } from "@/domain/planning";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import {
  addShoppingItemAction,
  clearCheckedShoppingAction,
  setShoppingCheckedAction,
  shoppingFromMenuAction,
} from "./actions";

export type ShoppingRow = {
  id: string;
  label: string;
  grams: number | null;
  note: string | null;
  aisle: Aisle;
  checked: boolean;
};

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

function quantity(row: ShoppingRow): string | null {
  if (row.grams !== null) return row.grams >= 1000 ? `${(row.grams / 1000).toLocaleString("fr")} kg` : `${row.grams} g`;
  return row.note;
}

/** Liste de courses du foyer : articles par rayon, cochables par tous ; ajout et remplissage depuis le menu. */
export function ShoppingList({ items, weekStart }: { items: ShoppingRow[]; weekStart: string }) {
  const t = useTranslations("shopping");
  const errorText = useErrorText();
  const [rows, setChecked] = useOptimistic(items, (current, change: { id: string; checked: boolean }) =>
    current.map((row) => (row.id === change.id ? { ...row, checked: change.checked } : row)),
  );
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string, checked: boolean) =>
    startTransition(async () => {
      setChecked({ id, checked });
      const result = await setShoppingCheckedAction(id, checked);
      if (result?.error) setMessage({ tone: "error", text: errorText(result.error) ?? "" });
    });

  const fill = () =>
    startTransition(async () => {
      const result = await shoppingFromMenuAction(weekStart);
      setMessage(
        result.error
          ? { tone: "error", text: errorText(result.error) ?? "" }
          : { tone: "success", text: t("filled", { count: result.count ?? 0 }) },
      );
    });

  const todo = rows.filter((row) => !row.checked);
  const done = rows.filter((row) => row.checked);

  const item = (row: ShoppingRow) => (
    <li key={row.id}>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1">
        <input
          type="checkbox"
          checked={row.checked}
          onChange={(event) => toggle(row.id, event.target.checked)}
          className="size-5 shrink-0 accent-primary"
        />
        <span className={row.checked ? "text-text-muted line-through" : ""}>
          {row.label}
          {quantity(row) && <span className="text-text-muted"> · {quantity(row)}</span>}
        </span>
      </label>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={fill} disabled={pending}>
          {t("fromMenu")}
        </Button>
        <p className="text-sm text-text-muted">{t("fromMenuHint")}</p>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {rows.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <>
          {AISLES.map((aisle) => {
            const inAisle = todo.filter((row) => row.aisle === aisle);
            if (inAisle.length === 0) return null;
            return (
              <section key={aisle} aria-labelledby={`aisle-${aisle}`} className="flex flex-col gap-1">
                <h3 id={`aisle-${aisle}`} className="font-semibold text-text-muted">
                  {t(`aisles.${aisle}`)}
                </h3>
                <ul className="flex flex-col">{inAisle.map(item)}</ul>
              </section>
            );
          })}
          {done.length > 0 && (
            <section aria-labelledby="aisle-done" className="flex flex-col gap-1">
              <h3 id="aisle-done" className="font-semibold text-text-muted">
                {t("inCart")}
              </h3>
              <ul className="flex flex-col">{done.map(item)}</ul>
              <Button
                variant="ghost"
                onClick={() => startTransition(async () => void (await clearCheckedShoppingAction()))}
                disabled={pending}
              >
                {t("clearChecked")}
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function AddShoppingItemForm() {
  const t = useTranslations("shopping");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await addShoppingItemAction({
            label: String(formData.get("label")),
            note: String(formData.get("note") ?? ""),
            aisle: String(formData.get("aisle")) as Aisle,
          });
          setError(result?.error ?? null);
        })
      }
      className="flex flex-col gap-3"
    >
      <Field label={t("label")} name="label" maxLength={80} required />
      <Field label={t("note")} name="note" maxLength={60} placeholder={t("notePlaceholder")} />
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("aisle")}</span>
        <select name="aisle" defaultValue="other" className={selectClass}>
          {AISLES.map((aisle) => (
            <option key={aisle} value={aisle}>
              {t(`aisles.${aisle}`)}
            </option>
          ))}
        </select>
      </label>
      {error && <Alert>{errorText(error)}</Alert>}
      <Button type="submit" disabled={pending}>
        {t("add")}
      </Button>
    </form>
  );
}
