"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";

import { deleteSavedMealAction } from "./actions";
import { ServeButton } from "./saved-meal-list";

/**
 * Carte d'un repas enregistré : nom et actions en tête, anneau des macros, aliments à déplier
 * et bouton « Ajouter » qui le sert au repas en cours. Supprimée, la carte disparaît tout de
 * suite ; la suppression n'est faite qu'à la fin du délai d'annulation.
 */
export function SavedMealItem({
  id,
  name,
  date,
  slot,
  foods,
  children,
}: {
  id: string;
  name: string;
  /** Jour et repas où « Ajouter » sert ce repas. */
  date: string;
  slot: MealSlot;
  /** Lignes du repas, une par aliment, déjà mises en forme. */
  foods: { label: string; amount: string }[];
  /** Anneau et macros. */
  children: ReactNode;
}) {
  const t = useTranslations("savedMeals");
  const toast = useToast();
  const errorText = useErrorText();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (hidden) return null;

  const remove = () => {
    setHidden(true);
    toast({
      message: t("deleted", { name }),
      undo: () => setHidden(false),
      onExpire: () =>
        void deleteSavedMealAction(id).then((result) => {
          if (result?.error) setHidden(false);
        }),
    });
  };

  const iconClass =
    "flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted";
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <div className="flex items-center gap-1">
        <Link
          href={`/meals/${id}`}
          className="min-w-0 flex-1 truncate text-lg font-bold underline-offset-4 hover:underline"
        >
          {name}
        </Link>
        <Link href={`/meals/${id}`} aria-label={t("edit", { name })} className={iconClass}>
          <Icon name="edit" size={18} />
        </Link>
        <button type="button" onClick={remove} aria-label={t("delete", { name })} className={iconClass}>
          <Icon name="trash" size={18} />
        </button>
      </div>
      {children}
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="flex items-center gap-3 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={`saved-meal-foods-${id}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1 text-left font-semibold text-primary"
        >
          {t("items", { count: foods.length })}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <Icon name="down" size={16} />
          </span>
        </button>
        <ServeButton meal={{ id, name }} date={date} slot={slot} onError={setError} variant="pill" />
      </div>
      <ul id={`saved-meal-foods-${id}`} hidden={!open} className="-mt-1 flex flex-col gap-1 text-sm">
        {foods.map((food, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span className="min-w-0">{food.label}</span>
            <span className="shrink-0 text-text-muted tabular-nums">{food.amount}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
