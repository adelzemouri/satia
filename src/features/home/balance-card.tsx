import { getTranslations } from "next-intl/server";

import {
  dayBalanceScore,
  type DayQuality,
  FIBER_GOAL_G,
  FRUIT_VEG_GOAL_PORTIONS,
  SALT_REFERENCE_G,
} from "@/domain/quality";
import { Link } from "@/i18n/navigation";
import { CountUp } from "@/ui/count-up";

/**
 * Équilibre du jour : une note indicative sur 100 qui se remplit au fil des repas, et les
 * trois repères qui la composent (fibres, fruits et légumes, sel).
 */
export async function BalanceCard({ quality }: { quality: DayQuality }) {
  const t = await getTranslations();
  const score = dayBalanceScore(quality);
  const rows = [
    {
      key: "fiber",
      label: t("quality.fiber"),
      value: t("quality.fiberValue", { value: quality.fiberG, goal: FIBER_GOAL_G }),
      percent: (quality.fiberG / FIBER_GOAL_G) * 100,
      high: false,
    },
    {
      key: "fruitVeg",
      label: t("quality.fruitVeg"),
      value: t("quality.fruitVegValue", { value: quality.fruitVegPortions, goal: FRUIT_VEG_GOAL_PORTIONS }),
      percent: (quality.fruitVegPortions / FRUIT_VEG_GOAL_PORTIONS) * 100,
      high: false,
    },
    {
      key: "salt",
      label: t("quality.salt"),
      value: t("home.balance.saltValue", { value: quality.saltG, reference: SALT_REFERENCE_G }),
      percent: (quality.saltG / SALT_REFERENCE_G) * 100,
      high: quality.saltG > SALT_REFERENCE_G,
    },
  ];
  return (
    <Link href="/quality" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface px-5 py-4">
      <span className="flex items-baseline justify-between gap-3">
        <h2 id="balance-title" className="font-bold">
          {t("home.balance.title")}
        </h2>
        <span className="shrink-0">
          <span className="font-display text-2xl font-extrabold text-primary">
            <CountUp value={score} memoryKey="balance-score" />
          </span>
          <span className="font-semibold text-text-muted">{t("home.balance.outOf")}</span>
          <span className="sr-only">{t("home.balance.score", { score })}</span>
        </span>
      </span>
      {/* Jauge en dégradé avec un repère à la position de la note. */}
      <span className="relative h-2.5 rounded-full bg-linear-to-r from-primary-soft to-primary" aria-hidden="true">
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-primary shadow"
          style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
        />
      </span>
      {/* Les trois repères en une ligne ; le détail est sur le bilan qualité. */}
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {rows.map((row) => (
          <span key={row.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${row.high ? "bg-accent" : row.percent >= 100 ? "bg-primary" : "bg-primary-soft"}`}
            />
            {row.label} {row.value}
          </span>
        ))}
      </span>
    </Link>
  );
}
