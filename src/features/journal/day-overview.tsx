import { getTranslations } from "next-intl/server";

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
        className={`block h-full rounded-full ${over ? "bg-accent" : "bg-primary"}`}
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
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-col">
        <span className="font-semibold text-text-muted">{over ? t("overLabel") : t("remainingLabel")}</span>
        <span className="font-display text-4xl font-extrabold tracking-tight">
          {t("kcalValue", { value: Math.abs(target - consumed) })}
        </span>
      </p>
      {bar}
      <p className="text-sm text-text-muted">{t("consumedOf", { value: consumed, goal: target })}</p>
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
