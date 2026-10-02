import { getTranslations } from "next-intl/server";

import { type DayQuality, FIBER_GOAL_G, FRUIT_VEG_GOAL_PORTIONS } from "@/domain/quality";

/** Repères indicatifs du jour : fibres et portions de fruits et légumes. */
export async function QualityBars({ quality }: { quality: DayQuality }) {
  const t = await getTranslations("quality");
  const bars = [
    {
      key: "fiber",
      value: quality.fiberG,
      goal: FIBER_GOAL_G,
      text: t("fiberValue", { value: quality.fiberG, goal: FIBER_GOAL_G }),
    },
    {
      key: "fruitVeg",
      value: quality.fruitVegPortions,
      goal: FRUIT_VEG_GOAL_PORTIONS,
      text: t("fruitVegValue", { value: quality.fruitVegPortions, goal: FRUIT_VEG_GOAL_PORTIONS }),
    },
  ] as const;
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 gap-3" aria-label={t("dayTitle")}>
        {bars.map((bar) => (
          <li key={bar.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t(bar.key)}</span>
            <span
              role="progressbar"
              aria-label={t(bar.key)}
              aria-valuemin={0}
              aria-valuemax={bar.goal}
              aria-valuenow={Math.min(bar.value, bar.goal)}
              aria-valuetext={bar.text}
              className="h-2 overflow-hidden rounded-full bg-surface-muted"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (bar.value / bar.goal) * 100)}%` }}
              />
            </span>
            <span className="text-sm text-text-muted">{bar.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">{t("indicative")}</p>
    </div>
  );
}
