"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import type { CoachTopic } from "@/domain/coach-topic";
import type { MealSlot } from "@/domain/meals";
import { useErrorText } from "@/features/auth/use-error-text";
import { AskCoach, type AskCoachHandle } from "@/features/coach/ask-coach";
import { CoachAvatar } from "@/features/coach/coach-avatar";
import { SaveMealForm } from "@/features/saved-meals/save-meal-form";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

import { copyEntriesAction } from "./actions";

/**
 * Le « ⋯ » d'un repas du journal : un petit panneau monte du bas avec les actions moins
 * fréquentes (copier aujourd'hui, enregistrer dans « Mes repas », demander à Pépin). Seul
 * « Ajouter » reste visible sur la carte, pour que le journal se lise sans défiler.
 */
export function MealActions({
  date,
  slot,
  title,
  copyTo,
  labels,
  coach,
}: {
  date: string;
  slot: MealSlot;
  /** Nom du repas en titre du panneau (« Déjeuner »). */
  title: string;
  /** Jour vers lequel copier le repas (aujourd'hui), absent quand on regarde déjà aujourd'hui. */
  copyTo: string | null;
  labels: string[];
  coach: { topic: CoachTopic; label: string; name: string };
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const askCoach = useRef<AskCoachHandle>(null);
  const [view, setView] = useState<"menu" | "save">("menu");
  const [pending, startTransition] = useTransition();
  const titleId = `meal-actions-${date}-${slot}`;

  const open = () => {
    setView("menu");
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const copy = () =>
    startTransition(async () => {
      if (!copyTo) return;
      const result = await copyEntriesAction({ fromDate: date, fromSlot: slot, toDate: copyTo, toSlot: null });
      if (!result?.error) haptic();
      toast({
        message: result?.error ? (errorText(result.error) ?? "") : t("journal.copied", { count: result?.count ?? 0 }),
      });
      close();
    });

  const item =
    "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-semibold transition-colors hover:bg-surface-muted active:bg-surface-muted disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={t("journal.mealActions", { slot, name: t(`slotsLower.${slot}`) })}
        aria-haspopup="dialog"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted transition active:scale-[0.94]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
          <circle cx="5.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="18.5" cy="12" r="1.8" />
        </svg>
      </button>

      {/* Échap ferme au clavier ; le toucher sur le fond grisé est un raccourci tactile. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="sheet-in fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-[1.75rem] bg-surface p-0 text-text backdrop:bg-text/45 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-sm lg:rounded-[1.75rem]"
      >
        <div className="flex flex-col gap-2 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:pb-5">
          <span aria-hidden="true" className="h-1.5 w-10 self-center rounded-full bg-border lg:hidden" />
          <div className="flex items-center gap-3 px-1">
            <h2 id={titleId} className="flex-1 font-display text-xl font-extrabold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("journal.closeActions")}
              className="flex size-11 items-center justify-center rounded-full text-text-muted"
            >
              <Icon name="close" />
            </button>
          </div>
          {view === "save" ? (
            <div className="px-1">
              <SaveMealForm date={date} slot={slot} labels={labels} onDone={close} onCancel={() => setView("menu")} />
            </div>
          ) : (
            <ul className="flex flex-col">
              {copyTo && (
                <li>
                  <button type="button" onClick={copy} disabled={pending} className={item}>
                    <span className="text-text-muted">
                      <Icon name="copy" />
                    </span>
                    {t("journal.copyToToday")}
                  </button>
                </li>
              )}
              <li>
                <button type="button" onClick={() => setView("save")} className={item}>
                  <span className="text-text-muted">
                    <Icon name="bookmark" />
                  </span>
                  {t("savedMeals.save")}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    askCoach.current?.open();
                  }}
                  className={item}
                >
                  <CoachAvatar size={24} />
                  {t("coach.askCoach", { name: coach.name })}
                </button>
              </li>
            </ul>
          )}
        </div>
      </dialog>

      <AskCoach topic={coach.topic} label={coach.label} coachName={coach.name} showTrigger={false} handle={askCoach} />
    </>
  );
}
