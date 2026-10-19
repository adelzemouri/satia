"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { MealSlot } from "@/domain/meals";
import { Icon } from "@/ui/icon";

import { AddPlanItemForm } from "./add-plan-item-form";

/**
 * Le « + » d'une case du tableau de la semaine (ordinateur) : une petite fenêtre s'ouvre avec le
 * jour et le repas déjà choisis, il ne reste qu'à prendre la recette (ou écrire le plat) et les parts.
 */
export function PlanCellAdd({
  date,
  slot,
  dayLabel,
  recipes,
  catalogRecipes,
  filled,
}: {
  date: string;
  slot: MealSlot;
  dayLabel: string;
  recipes: { id: string; name: string }[];
  catalogRecipes: { id: string; name: string }[];
  /** Case qui a déjà un plat : le « + » se fait discret, en bas de la case. */
  filled: boolean;
}) {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  // Le formulaire est remonté à chaque ouverture : il repart vide.
  const [round, setRound] = useState(0);
  const titleId = `plan-cell-${date}-${slot}`;
  const label = t("plan.cellAdd", { day: dayLabel, slot: t(`slotsLower.${slot}`) });

  const open = () => {
    setRound((value) => value + 1);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={label}
        aria-haspopup="dialog"
        className={
          filled
            ? "flex min-h-9 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-muted hover:text-primary active:scale-[0.96]"
            : "flex min-h-24 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border text-text-muted transition hover:border-primary hover:text-primary active:scale-[0.97]"
        }
      >
        <Icon name="plus" />
      </button>

      {/* Échap ferme au clavier ; un clic sur le fond grisé aussi. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="sheet-in m-auto h-fit w-full max-w-sm rounded-[1.75rem] bg-surface p-0 text-text backdrop:bg-text/45"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <h2
              id={titleId}
              className="flex-1 font-display text-xl font-extrabold tracking-tight first-letter:uppercase"
            >
              {dayLabel} · {t(`slots.${slot}`)}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("plan.close")}
              className="flex size-11 items-center justify-center rounded-full text-text-muted"
            >
              <Icon name="close" />
            </button>
          </div>
          <AddPlanItemForm
            key={round}
            days={[{ date, label: dayLabel }]}
            defaultDate={date}
            fixed={{ date, slot }}
            recipes={recipes}
            catalogRecipes={catalogRecipes}
            onDone={close}
          />
        </div>
      </dialog>
    </>
  );
}
