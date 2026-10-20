"use client";

import { useLocale, useTranslations } from "next-intl";

import { addDays } from "@/domain/energy";
import type { MealSlot } from "@/domain/meals";
import { isoWeekStart } from "@/domain/streak";
import { formatWeekday } from "@/ui/format-date";

const PLANNED_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const satisfies readonly MealSlot[];

const chip = (selected: boolean) =>
  `min-h-11 rounded-full px-4 text-[0.95rem] transition active:scale-[0.96] ${
    selected ? "bg-primary font-semibold text-on-primary" : "border border-border bg-surface text-text"
  }`;

/** « mardi 20 » : le jour choisi, dans le bouton qui valide. */
export function dayName(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * Les sept jours d'une semaine (cette semaine ou la suivante) ; les jours déjà passés restent
 * visibles mais ne se choisissent pas.
 */
export function DayPicker({
  today,
  value,
  onChange,
}: {
  today: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const thisWeek = isoWeekStart(today);
  const weekStart = isoWeekStart(value);
  const nextWeek = weekStart === thisWeek;
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t("day")}</legend>
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className="font-semibold">
          {t("day")}
        </span>
        <button
          type="button"
          onClick={() => onChange(nextWeek ? addDays(thisWeek, 7) : today)}
          className="min-h-11 px-1 text-sm font-semibold text-primary"
        >
          {nextWeek ? t("next") : t("thisWeek")}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date) => {
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              disabled={date < today}
              aria-pressed={selected}
              aria-label={dayName(date, locale)}
              onClick={() => onChange(date)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs transition active:scale-[0.95] disabled:opacity-40 ${
                selected ? "bg-primary text-on-primary" : "border border-border bg-surface text-text-muted"
              }`}
            >
              {formatWeekday(date, locale)}
              <span className={`text-base font-bold ${selected ? "" : "text-text"}`}>{Number(date.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Le repas du menu : petit-déjeuner, déjeuner, dîner ou collation. */
export function SlotPicker({ value, onChange }: { value: MealSlot; onChange: (slot: MealSlot) => void }) {
  const t = useTranslations();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{t("plan.slot")}</legend>
      <div className="flex flex-wrap gap-2">
        {PLANNED_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={slot === value}
            onClick={() => onChange(slot)}
            className={chip(slot === value)}
          >
            {t(`slots.${slot}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Nombre de parts, de ½ à 20, par pas d'une part. */
export function ServingsStepper({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (servings: number) => void;
  compact?: boolean;
}) {
  const t = useTranslations("plan");
  const step = (delta: number) => onChange(Math.min(20, Math.max(1, value + delta)));
  const round = `flex shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xl transition active:scale-[0.92] disabled:opacity-40 ${
    compact ? "size-10" : "size-11"
  }`;
  return (
    <div className="flex items-center gap-3">
      {!compact && <span className="flex-1 font-semibold">{t("servingsLabel")}</span>}
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= 1}
        aria-label={t("lessServings")}
        className={round}
      >
        −
      </button>
      <output aria-live="polite" className="min-w-14 text-center font-bold tabular-nums">
        {t("servings", { count: value })}
      </output>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={value >= 20}
        aria-label={t("moreServings")}
        className={round}
      >
        +
      </button>
    </div>
  );
}
