"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import type { CalendarDay, StreakStats } from "@/domain/streak";
import { formatDay, formatWeekday } from "@/ui/format-date";
import { Icon } from "@/ui/icon";
import { useSheetDrag } from "@/ui/sheet-drag";

/**
 * Le compteur de jours de l'accueil et sa fiche « Ma série » : ce que compte le chiffre,
 * la série en cours, la meilleure, le total, les 5 dernières semaines et les étapes franchies.
 * Les étapes viennent de la meilleure série : une étape gagnée ne se perd jamais.
 */
export function StreakSheet({
  stats,
  calendar,
  today,
  celebrate,
}: {
  stats: StreakStats;
  calendar: CalendarDay[];
  today: string;
  /** Le jour d'une étape, le chiffre passe en rouge pomme. */
  celebrate: boolean;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  useSheetDrag(dialog, close);
  const days = stats.current.days;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={t("streakSheet.open", { days })}
        className={`ml-auto flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-bold whitespace-nowrap transition active:scale-[0.96] ${celebrate ? "celebrate bg-pomme text-on-pomme" : "bg-pomme-soft text-text"}`}
      >
        <Icon name="sprout" size={20} />
        {t("streakShort", { days })}
      </button>

      {/* Échap ferme au clavier ; le toucher sur le fond grisé est un raccourci tactile. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        aria-labelledby="streak-sheet-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="sheet-in fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-surface p-0 text-text backdrop:bg-text/45 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-md lg:rounded-[1.75rem]"
      >
        <div className="flex flex-col gap-5 px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <span aria-hidden="true" className="h-1.5 w-10 self-center rounded-full bg-border lg:hidden" />
          <div className="-mt-2 flex items-center gap-3">
            <h2 id="streak-sheet-title" className="flex-1 font-display text-2xl font-extrabold tracking-tight">
              {t("streakSheet.title")}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("streakSheet.close")}
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-text-muted"
            >
              <Icon name="close" />
            </button>
          </div>

          <p className="text-sm text-text-muted">
            <strong className="font-semibold text-text">{t("streakSheet.explainStrong")}</strong>{" "}
            {t("streakSheet.explain")}
          </p>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <Figure value={days} label={t("streakSheet.current", { days })} main />
            <Figure value={stats.best} label={t("streakSheet.best")} />
            <Figure value={stats.totalDays} label={t("streakSheet.total", { days: stats.totalDays })} />
          </dl>

          <section aria-labelledby="streak-calendar-title" className="flex flex-col gap-2">
            <h3 id="streak-calendar-title" className="text-sm font-bold">
              {t("streakSheet.calendarTitle")}
            </h3>
            <div className="grid grid-cols-7 gap-1" role="list">
              {calendar.slice(0, 7).map((day) => (
                <span
                  key={`dow-${day.date}`}
                  aria-hidden="true"
                  className="text-center text-xs font-semibold text-text-muted"
                >
                  {formatWeekday(day.date, locale).slice(0, 1).toUpperCase()}
                </span>
              ))}
              {calendar.map((day) => (
                <CalendarCell key={day.date} day={day} today={today} locale={locale} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-pomme" />
                {t("streakSheet.legendLogged")}
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-[3px] border border-dashed border-pomme bg-pomme-soft"
                />
                {t("streakSheet.legendRest")}
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-surface-muted" />
                {t("streakSheet.legendEmpty")}
              </li>
            </ul>
          </section>

          <section aria-labelledby="streak-steps-title" className="flex flex-col gap-3">
            <h3 id="streak-steps-title" className="text-sm font-bold">
              {t("streakSheet.stepsTitle")}
            </h3>
            {stats.steps.length > 0 ? (
              <ul className="grid grid-cols-5 gap-x-1 gap-y-3">
                {stats.steps.map((step) => (
                  <li
                    key={step.days}
                    aria-label={t("streakSheet.stepReached", {
                      step: t("streakSheet.step", { days: String(step.days) }),
                      date: formatDay(step.reachedOn, locale, "short"),
                    })}
                    className="flex flex-col items-center gap-1 text-center text-xs leading-tight text-text-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-12 items-center justify-center rounded-full bg-pomme font-display text-lg font-extrabold text-on-pomme tabular-nums"
                    >
                      {step.days}
                    </span>
                    <span aria-hidden="true" className="font-semibold text-text">
                      {t("streakSheet.step", { days: String(step.days) })}
                    </span>
                    <span aria-hidden="true">{formatDay(step.reachedOn, locale, "short")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">{t("streakSheet.noSteps")}</p>
            )}
            {stats.next ? (
              stats.steps.length > 0 && (
                <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-text-muted">
                  {t.rich("streakSheet.next", {
                    days: stats.next.days,
                    remaining: stats.next.remaining,
                    b: (chunk) => <strong className="font-semibold text-text">{chunk}</strong>,
                  })}
                </p>
              )
            ) : (
              <p className="rounded-xl bg-pomme-soft px-3 py-2 text-sm font-semibold">{t("streakSheet.allDone")}</p>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}

function Figure({ value, label, main = false }: { value: number; label: string; main?: boolean }) {
  return (
    <div
      className={`flex flex-col-reverse justify-end gap-1 rounded-2xl px-2 py-3 ${main ? "bg-pomme-soft" : "bg-surface-muted"}`}
    >
      <dt className="text-xs leading-tight font-semibold text-text-muted">{label}</dt>
      <dd className="font-display text-3xl leading-none font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function CalendarCell({ day, today, locale }: { day: CalendarDay; today: string; locale: string }) {
  const t = useTranslations("home.streakSheet");
  if (day.state === "future") return <span role="presentation" />;
  const date = formatDay(day.date, locale);
  const label =
    day.state === "logged"
      ? t("dayLogged", { date })
      : day.state === "rest"
        ? t("dayRest", { date })
        : t("dayEmpty", { date });
  const tone =
    day.state === "logged"
      ? "bg-pomme text-on-pomme"
      : day.state === "rest"
        ? "border-2 border-dashed border-pomme bg-pomme-soft text-text"
        : "bg-surface-muted text-text-muted";
  return (
    <span
      role="listitem"
      aria-label={label}
      aria-current={day.date === today ? "date" : undefined}
      className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${tone} ${day.date === today ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}
    >
      <span aria-hidden="true">{Number(day.date.slice(8))}</span>
    </span>
  );
}
