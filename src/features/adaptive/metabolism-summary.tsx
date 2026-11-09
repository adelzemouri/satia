import { getTranslations } from "next-intl/server";

import { COACH_NAME } from "@/config/app";
import type { Measurement, MetabolismSummary } from "@/domain/adaptive";
import { Link } from "@/i18n/navigation";
import { cardTone } from "@/ui/card";

type Measured = Extract<Measurement, { status: "measured" }>;

/** Ancrage d'une étiquette : centrée, sauf près d'un bord ou d'une étiquette voisine. */
function anchor(position: number, toward: "left" | "right" | "center" = "center"): string {
  if (position < 12 || toward === "right") return "translate-x-0";
  if (position > 88 || toward === "left") return "-translate-x-full";
  return "-translate-x-1/2";
}

/**
 * « L'essentiel » : ce qui est mangé face à l'objectif, ce que ça donne sur la balance, et
 * quoi faire. Une règle place l'apport, la dépense et l'objectif : sous la dépense on perd,
 * au-dessus on prend. Toute la largeur sur ordinateur (ce n'est pas une `section`).
 */
export async function MetabolismSummaryCard({
  summary,
  measurement,
  goalKcal,
  days,
}: {
  summary: MetabolismSummary;
  measurement: Measured;
  goalKcal: number;
  days: number;
}) {
  const t = await getTranslations("metabolism");
  const { scale } = summary;
  const gap = Math.abs(summary.gapKcal);
  // Mangé et objectif trop proches : les étiquettes s'écartent de part et d'autre.
  const close = Math.abs(scale.intake - scale.goal) < 22;
  const intakeFirst = scale.intake <= scale.goal;
  const advice = summary.intake === "on" ? null : summary.intake;

  return (
    <div
      role="region"
      aria-labelledby="summary-title"
      className={`flex flex-col gap-5 rounded-[var(--radius-card)] p-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:p-7 ${cardTone.highlight}`}
    >
      <div className="flex flex-col gap-3">
        <h2 id="summary-title" className="text-sm font-bold tracking-wider text-primary uppercase">
          {t("summary.title", { days })}
        </h2>
        <p className="font-display text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
          {t(`summary.intake.${summary.intake}`, { gap })}
        </p>
        <p>{t(`summary.weight.${summary.kind}.${summary.direction}`, { change: measurement.weeklyChangeKg })}</p>
        {advice && (
          <p className="border-t border-primary/20 pt-3">
            {t.rich(`summary.advice.${summary.kind}.${advice}`, {
              gap,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        )}
        {summary.kind === "gain" && advice === "below" && (
          <Link
            href={{ pathname: "/coach", query: { ask: "addCalories" } }}
            className="self-start font-semibold text-primary"
          >
            {t("summary.askPepin", { name: COACH_NAME })} ›
          </Link>
        )}
      </div>

      <figure className="flex flex-col gap-2 tabular-nums lg:rounded-2xl lg:bg-surface/60 lg:px-6 lg:py-5">
        <div aria-hidden className="relative h-11 text-xs leading-tight sm:text-sm">
          <span
            className={`absolute bottom-0 text-center whitespace-nowrap ${anchor(scale.intake, close ? (intakeFirst ? "left" : "right") : "center")}`}
            style={{ left: `${scale.intake}%` }}
          >
            <b className="text-sm sm:text-base">{t("kcalPerDay", { value: measurement.averageIntake })}</b>
            <br />
            {t("summary.eaten")}
          </span>
          <span
            className={`absolute bottom-0 text-center whitespace-nowrap text-primary ${anchor(scale.goal, close ? (intakeFirst ? "right" : "left") : "center")}`}
            style={{ left: `${scale.goal}%` }}
          >
            <b className="text-sm sm:text-base">{t("kcalPerDay", { value: goalKcal })}</b>
            <br />
            {t("summary.target")}
          </span>
        </div>
        <div aria-hidden className="relative flex h-3.5">
          <div className="rounded-l-full bg-accent-soft" style={{ width: `${scale.tdee}%` }} />
          <div className="flex-1 rounded-r-full bg-surface" />
          <span className="absolute -top-1.5 h-[26px] w-0.5 bg-text" style={{ left: `${scale.tdee}%` }} />
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-primary"
            style={{
              left: `${Math.min(scale.intake, scale.goal)}%`,
              width: `${Math.abs(scale.goal - scale.intake)}%`,
            }}
          />
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text ring-2 ring-surface"
            style={{ left: `${scale.intake}%` }}
          />
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface"
            style={{ left: `${scale.goal}%` }}
          />
        </div>
        <div aria-hidden className="relative h-9 text-xs leading-tight sm:text-sm">
          <span
            className={`absolute top-0 text-center whitespace-nowrap ${anchor(scale.tdee)}`}
            style={{ left: `${scale.tdee}%` }}
          >
            <b className="text-sm sm:text-base">{t("kcalPerDay", { value: measurement.tdee })}</b>
            <br />
            {t("summary.burned")}
          </span>
        </div>
        <div aria-hidden className="flex justify-between text-xs sm:text-sm">
          <span className="text-accent">{t("summary.losing")}</span>
          <span className="text-primary">{t("summary.gaining")}</span>
        </div>
        <figcaption className="text-sm text-text-muted">
          <span className="sr-only">
            {t("summary.scaleLabel")} : {t("kcalPerDay", { value: measurement.averageIntake })} {t("summary.eaten")},{" "}
            {t("kcalPerDay", { value: measurement.tdee })} {t("summary.burned")}, {t("kcalPerDay", { value: goalKcal })}{" "}
            {t("summary.target")}.{" "}
          </span>
          {t("summary.scaleHint")}
        </figcaption>
      </figure>
    </div>
  );
}
