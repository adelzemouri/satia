import { getTranslations } from "next-intl/server";

import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import type { Nutrients } from "@/domain/nutrition";
import { CountUp } from "@/ui/count-up";

import { RingArc } from "./ring-arc";
import { RingGain } from "./ring-gain";

type Goal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Les calories du jour en une phrase : ce qu'il reste à manger (ou le dépassement), puis une
 * barre de la part consommée. `compact` donne la version en barre du journal.
 */
export async function CalorieSummary({
  totals,
  goal,
  compact = false,
  burnedKcal,
}: {
  totals: Nutrients;
  goal: Goal | null;
  compact?: boolean;
  /** Dépense de l'activité du jour (déjà comprise dans l'objectif), affichée sur l'accueil. */
  burnedKcal?: number;
}) {
  const t = await getTranslations("home");
  const consumed = Math.round(totals.kcal);
  const target = goal?.kcal ?? 0;
  const percent = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const over = target > 0 && consumed > target;
  const bar = goal && (
    <span
      role="progressbar"
      aria-label={t("consumed", { value: consumed })}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={consumed}
      className="block h-3 overflow-hidden rounded-full bg-surface-muted"
    >
      <span
        className={`bar-grow block h-full rounded-full ${over ? "bg-text-muted" : "bg-primary"}`}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
  if (!goal) return <p className="font-semibold">{t("consumed", { value: consumed })}</p>;
  if (compact) {
    // Journal : consommé et restant côte à côte, pour retrouver le chiffre de l'anneau de l'accueil.
    return (
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 tabular-nums">
          <span className="font-semibold">{t("consumed", { value: consumed })}</span>
          <span className={`font-bold ${over ? "text-text-muted" : "text-primary"}`}>
            {over ? t("leftOver", { value: consumed - target }) : t("left", { value: target - consumed })}
          </span>
        </p>
        {bar}
        <p className="text-sm text-text-muted">{t("goalKcal", { goal: target })}</p>
      </div>
    );
  }
  // Anneau de l'accueil : la part consommée en arc, ce qu'il reste au centre.
  const radius = 54;
  const offset = 2 * Math.PI * radius * (1 - percent / 100);
  return (
    <div className="flex items-center gap-5">
      <div
        role="progressbar"
        aria-label={t("consumed", { value: consumed })}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={consumed}
        className="relative size-36 shrink-0"
      >
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="12" className="stroke-surface-muted" />
          <RingArc radius={radius} offset={offset} over={over} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
          <span className="font-display text-3xl font-extrabold tracking-tight">
            <CountUp value={Math.abs(target - consumed)} memoryKey="ring-left" />
          </span>
          <span className="text-sm font-semibold text-text-muted">{over ? t("ringOver") : t("ringLeft")}</span>
        </span>
        <RingGain key={consumed} consumed={consumed} />
      </div>
      <dl className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col">
          <dt className="text-sm font-semibold text-text-muted">{t("goalLabel")}</dt>
          <dd className="text-lg font-bold">{t("kcalValue", { value: target })}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-semibold text-text-muted">{t("eatenLabel")}</dt>
          <dd className="text-lg font-bold">{t("kcalValue", { value: consumed })}</dd>
        </div>
        {burnedKcal !== undefined && (
          <div className="flex flex-col">
            <dt className="text-sm font-semibold text-text-muted">{t("burnedLabel")}</dt>
            <dd className="text-lg font-bold">{t("kcalValue", { value: burnedKcal })}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Barres de progression des macronutriments. */
export async function MacroBars({ totals, goal }: { totals: Nutrients; goal: Goal | null }) {
  const t = await getTranslations("home");
  const macros = [
    { key: "protein", value: totals.proteinG, goal: goal?.proteinG ?? 0, color: "bg-protein" },
    { key: "carbs", value: totals.carbsG, goal: goal?.carbsG ?? 0, color: "bg-carbs" },
    { key: "fat", value: totals.fatG, goal: goal?.fatG ?? 0, color: "bg-fat" },
  ] as const;
  return (
    <ul className="grid grid-cols-3 gap-3" aria-label={t("macros")}>
      {macros.map((macro) => {
        const percent = macro.goal > 0 ? Math.min(100, (macro.value / macro.goal) * 100) : 0;
        return (
          <li key={macro.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t(macro.key)}</span>
            <span
              role="progressbar"
              aria-label={t(macro.key)}
              aria-valuemin={0}
              aria-valuemax={Math.round(macro.goal)}
              aria-valuenow={Math.round(macro.value)}
              className="h-2 overflow-hidden rounded-full bg-surface-muted"
            >
              <span className={`bar-grow block h-full rounded-full ${macro.color}`} style={{ width: `${percent}%` }} />
            </span>
            <span className="text-sm text-text-muted">
              {t("macroValue", { value: Math.round(macro.value), goal: Math.round(macro.goal) })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const MACRO_DOTS = [
  ["protein", "proteinG", "bg-protein"],
  ["carbs", "carbsG", "bg-carbs"],
  ["fat", "fatG", "bg-fat"],
] as const;

/** Les macros d'un repas sur une ligne, sous son titre. */
export async function MacroLine({ totals }: { totals: Nutrients }) {
  const t = await getTranslations("home");
  return (
    <ul className="-mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted" aria-label={t("macros")}>
      {MACRO_DOTS.map(([key, field, color]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
          {t("macroGrams", { name: t(key), value: Math.round(totals[field]) })}
        </li>
      ))}
    </ul>
  );
}

/** Répartition des calories et des macros entre les repas de la journée, en tableau. */
export async function MacroSplit({
  bySlot,
  totals,
}: {
  bySlot: Record<MealSlot, { entries: unknown[]; totals: Nutrients }>;
  totals: Nutrients;
}) {
  const t = await getTranslations();
  const share = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const slots = MEAL_SLOTS.filter((slot) => bySlot[slot].entries.length > 0);
  const cell = "px-2 py-2 text-right tabular-nums";
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-muted px-3 py-2">
      <h3 className="text-sm font-semibold">{t("journal.splitTitle")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("journal.splitCaption")}</caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="py-2 pr-2 text-left font-semibold">
                {t("journal.slot")}
              </th>
              <th scope="col" className={`${cell} font-semibold`}>
                kcal
              </th>
              {MACRO_DOTS.map(([key, , color]) => (
                <th key={key} scope="col" className={`${cell} font-semibold`}>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
                    {t(`home.${key}Short`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slots.map((slot) => {
              const values = bySlot[slot].totals;
              return (
                <tr key={slot}>
                  <th scope="row" className="py-2 pr-2 text-left font-semibold">
                    {t(`slots.${slot}`)}
                  </th>
                  <td className={cell}>
                    {Math.round(values.kcal)}
                    <span className="block text-xs text-text-muted">{share(values.kcal, totals.kcal)} %</span>
                  </td>
                  {MACRO_DOTS.map(([key, field]) => (
                    <td key={key} className={cell}>
                      {t("journal.grams", { value: Math.round(values[field]) })}
                      <span className="block text-xs text-text-muted">{share(values[field], totals[field])} %</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
