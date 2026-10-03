import type { CSSProperties } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import type { Nutrients } from "@/domain/nutrition";

type Goal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Les calories du jour en une phrase : ce qu'il reste à manger (ou le dépassement), puis une
 * barre de la part consommée. `compact` donne la version d'une ligne du journal.
 */
export async function CalorieSummary({
  totals,
  goal,
  compact = false,
}: {
  totals: Nutrients;
  goal: Goal | null;
  compact?: boolean;
}) {
  const t = await getTranslations("home");
  const format = await getFormatter();
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
        className={`bar-grow block h-full rounded-full ${over ? "bg-accent" : "bg-primary"}`}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
  if (compact || !goal) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-semibold">
          {goal ? t("consumedOf", { value: consumed, goal: target }) : t("consumed", { value: consumed })}
        </p>
        {bar}
      </div>
    );
  }
  // Anneau de l'accueil : la part consommée en arc, ce qu'il reste au centre.
  const radius = 54;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - percent / 100);
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
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={offset}
            className={`ring-fill ${over ? "stroke-accent" : "stroke-primary"}`}
            style={{ "--ring-length": length } as CSSProperties}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
          <span className="font-display text-3xl font-extrabold tracking-tight">
            {format.number(Math.abs(target - consumed))}
          </span>
          <span className="text-sm font-semibold text-text-muted">{over ? t("ringOver") : t("ringLeft")}</span>
        </span>
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
