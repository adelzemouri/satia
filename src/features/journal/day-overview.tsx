import { getTranslations } from "next-intl/server";

import type { Nutrients } from "@/domain/nutrition";

type Goal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/** Anneau des calories du jour : la part consommée de l'objectif. */
export async function CalorieRing({ totals, goal }: { totals: Nutrients; goal: Goal | null }) {
  const t = await getTranslations("home");
  const consumed = Math.round(totals.kcal);
  const target = goal?.kcal ?? 0;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" width={112} height={112} aria-hidden="true" className="shrink-0 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-surface-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={over ? "stroke-accent" : "stroke-primary"}
        />
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-display text-2xl font-semibold">{t("consumed", { value: consumed })}</p>
        {goal && (
          <>
            <p className="text-text-muted">{t("ofGoal", { value: goal.kcal })}</p>
            <p className="font-semibold">
              {over ? t("over", { value: consumed - goal.kcal }) : t("remaining", { value: goal.kcal - consumed })}
            </p>
          </>
        )}
      </div>
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
              <span className={`block h-full rounded-full ${macro.color}`} style={{ width: `${percent}%` }} />
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
