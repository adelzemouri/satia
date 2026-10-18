"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { macrosFor } from "@/domain/energy";
import { ACTIVITY_LEVELS, type ActivityLevel, type Goal, goalChangesWeight, type Pace, PACES } from "@/domain/profile";
import { setTargetWeightAction, setWaterGoalAction } from "@/features/journal/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { OptionList } from "@/ui/option-list";
import { PrivateBlock, useWeightShown } from "@/ui/private";

import { proposeGoalAction, setAutomaticCaloriesAction, setManualCaloriesAction, updateGoalAction } from "./actions";
import { BigValue, GoalNote, GoalScreen } from "./goal-screen";
import { Ruler } from "./ruler";
import type { GoalProposal } from "@/server/goal-settings";

const MACRO_DOT = { protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" } as const;

/** Calories qu'entraînerait un changement, demandées au serveur à chaque choix. */
function useProposal(change: Parameters<typeof proposeGoalAction>[0], key: string) {
  const [proposal, setProposal] = useState<GoalProposal | null>(null);
  useEffect(() => {
    let current = true;
    void proposeGoalAction(change).then((next) => current && setProposal(next));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` résume `change`
  }, [key]);
  return proposal;
}

function ProposalNote({ proposal }: { proposal: GoalProposal | null }) {
  const t = useTranslations("goals");
  if (!proposal) return null;
  return (
    <GoalNote title={t("proposalTitle")}>
      {proposal.locked
        ? t("proposalLocked")
        : proposal.kcal === proposal.currentKcal
          ? t("proposalSame", { kcal: proposal.kcal })
          : t("proposalChange", { from: proposal.currentKcal, to: proposal.kcal })}{" "}
      {!proposal.locked && t(proposal.measured ? "proposalMeasured" : "proposalFormula")}
    </GoalNote>
  );
}

export function ObjectiveEditor({
  goal: initialGoal,
  pace: initialPace,
  allowed,
}: {
  goal: Goal;
  pace: Pace;
  allowed: readonly Goal[];
}) {
  const t = useTranslations("goals");
  const tOn = useTranslations("onboarding");
  const [goal, setGoal] = useState(initialGoal);
  const [pace, setPace] = useState(initialPace);
  const proposal = useProposal({ goal, pace }, `${goal}-${pace}`);
  const kind = goal === "gain_muscle" ? "Gain" : "Loss";
  return (
    <GoalScreen
      title={tOn("goal.title")}
      save={() => updateGoalAction({ goal, pace })}
      note={<ProposalNote proposal={proposal} />}
    >
      {allowed.length < 4 && <p className="text-sm text-text-muted">{tOn("goal.minorHint")}</p>}
      <OptionList
        legend={tOn("goal.title")}
        hideLegend
        name="goal"
        value={goal}
        onChange={setGoal}
        options={allowed.map((value) => ({ value, label: tOn(`goal.${value}`) }))}
      />
      {goalChangesWeight(goal) && (
        <OptionList
          legend={t("paceTitle")}
          name="pace"
          value={pace}
          onChange={setPace}
          options={PACES.map((value) => ({
            value,
            label: tOn(`pace.${value}`),
            hint: tOn(`pace.${value}${kind}`),
          }))}
        />
      )}
    </GoalScreen>
  );
}

export function ActivityEditor({ level: initialLevel }: { level: ActivityLevel }) {
  const tOn = useTranslations("onboarding");
  const [level, setLevel] = useState(initialLevel);
  const proposal = useProposal({ activityLevel: level }, String(level));
  return (
    <GoalScreen
      title={tOn("activity.title")}
      save={() => updateGoalAction({ activityLevel: level })}
      note={<ProposalNote proposal={proposal} />}
    >
      <OptionList
        legend={tOn("activity.title")}
        hideLegend
        name="activity"
        value={level}
        onChange={setLevel}
        options={ACTIVITY_LEVELS.map((value) => ({
          value,
          label: tOn(`activity.${value}.label`),
          hint: tOn(`activity.${value}.hint`),
        }))}
      />
    </GoalScreen>
  );
}

export function TargetWeightEditor({
  current,
  target,
  goal,
  minHealthy,
  maxHealthy,
}: {
  current: number;
  target: number | null;
  goal: "lose_weight" | "gain_muscle";
  minHealthy: number;
  maxHealthy: number;
}) {
  const t = useTranslations("goals");
  const format = useFormatter();
  const kg = (value: number) => format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Dans le sens de l'objectif uniquement, et jamais sous un poids de forme.
  const min = goal === "lose_weight" ? minHealthy : Math.round((current + 0.1) * 10) / 10;
  const max = goal === "lose_weight" ? Math.round((current - 0.1) * 10) / 10 : Math.round((current + 25) * 10) / 10;
  const start = target ?? (goal === "lose_weight" ? Math.max(min, Math.round(current - 3)) : Math.round(current + 3));
  const [value, setValue] = useState(Math.min(max, Math.max(min, start)));
  const router = useRouter();
  const gap = value - current;
  const room = min < max;
  const shown = useWeightShown();
  return (
    <GoalScreen
      title={t("weightTitle")}
      save={() => setTargetWeightAction(value)}
      // Pas d'enregistrement à l'aveugle : la règle est floutée tant que le poids est masqué.
      canSave={room && shown}
      note={
        <div className="flex flex-col gap-3">
          <GoalNote title={t("healthyTitle")}>
            {t("healthyBody", { min: kg(minHealthy), max: kg(maxHealthy) })}
          </GoalNote>
          {target !== null && (
            <button
              type="button"
              onClick={() => void setTargetWeightAction(null).then(() => router.push("/profile"))}
              className="min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("weightClear")}
            </button>
          )}
        </div>
      }
    >
      {/* Le poids reste masqué tant qu'on ne l'a pas affiché, comme sur la page Poids. */}
      <PrivateBlock className="flex flex-col gap-5">
        <p className="text-center text-text-muted">{t("weightToday", { kg: kg(current) })}</p>
        {room ? (
          <>
            <BigValue value={kg(value)} unit="kg" />
            <Ruler
              min={min}
              max={max}
              step={0.1}
              value={value}
              onChange={setValue}
              label={t("weightLabel")}
              valueText={`${kg(value)} kg`}
              formatMajor={(major) => format.number(major)}
            />
            <p className="text-center text-text-muted">
              {t("weightGap", { gap: `${gap > 0 ? "+" : "−"}${kg(Math.abs(gap))}` })}
            </p>
          </>
        ) : (
          <p className="text-center">{t("weightNoRoom")}</p>
        )}
      </PrivateBlock>
    </GoalScreen>
  );
}

export function WaterEditor({ glasses }: { glasses: number }) {
  const t = useTranslations("goals");
  const format = useFormatter();
  const [value, setValue] = useState(glasses);
  const liters = (count: number) => format.number(count / 4, { maximumFractionDigits: 2 });
  return (
    <GoalScreen
      title={t("waterTitle")}
      save={() => setWaterGoalAction(value)}
      note={<GoalNote title={t("waterNoteTitle")}>{t("waterNote")}</GoalNote>}
    >
      <BigValue value={liters(value)} unit="L" />
      <Ruler
        min={1}
        max={20}
        step={1}
        value={value}
        onChange={setValue}
        tickPx={24}
        majorEvery={4}
        label={t("waterLabel")}
        valueText={t("waterValueText", { liters: liters(value), glasses: value })}
        formatMajor={(major) => `${liters(major)} L`}
      />
      <p className="text-center text-text-muted">{t("waterGlasses", { glasses: value })}</p>
    </GoalScreen>
  );
}

export function CaloriesEditor({
  kcal,
  locked,
  floor,
  maxKcal,
  macroInput,
}: {
  kcal: number;
  locked: boolean;
  floor: number;
  maxKcal: number;
  macroInput: Parameters<typeof macrosFor>[1];
}) {
  const t = useTranslations("goals");
  const tAll = useTranslations();
  const format = useFormatter();
  const [manual, setManual] = useState(locked);
  const [value, setValue] = useState(Math.min(maxKcal, Math.max(floor, kcal)));
  // Retour à l'automatique : le chiffre affiché est celui que le calcul donnerait aujourd'hui.
  const automatic = useProposal({ automatic: true }, "automatic");
  const shown = manual ? value : (automatic?.kcal ?? kcal);
  const macros = macrosFor(shown, macroInput);
  return (
    <GoalScreen
      title={t("caloriesTitle")}
      save={() => (manual ? setManualCaloriesAction(value) : setAutomaticCaloriesAction())}
      note={
        <GoalNote title={t(manual ? "manualTitle" : "autoTitle")}>
          {manual ? t("manualNote", { floor }) : t("autoNote")}
        </GoalNote>
      }
    >
      <div
        role="radiogroup"
        aria-label={t("caloriesMode")}
        className="mx-auto flex gap-1 rounded-full bg-surface-muted p-1"
      >
        {([false, true] as const).map((option) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={manual === option}
            onClick={() => setManual(option)}
            className={`min-h-10 rounded-full px-4 font-bold transition-colors ${manual === option ? "bg-surface text-text shadow-sm" : "text-text-muted"}`}
          >
            {t(option ? "manual" : "auto")}
          </button>
        ))}
      </div>
      <BigValue value={format.number(shown)} unit="kcal" />
      {manual ? (
        <Ruler
          min={floor}
          max={maxKcal}
          step={10}
          value={value}
          onChange={setValue}
          label={t("caloriesLabel")}
          valueText={`${format.number(value)} kcal`}
          formatMajor={(major) => format.number(major)}
        />
      ) : (
        <p className="text-center text-text-muted">{t("autoHint")}</p>
      )}
      <ul className="grid grid-cols-3 gap-2" aria-label={t("macrosLabel")}>
        {(
          [
            ["protein", macros.proteinG],
            ["carbs", macros.carbsG],
            ["fat", macros.fatG],
          ] as const
        ).map(([key, grams]) => (
          <li key={key} className="flex flex-col items-center gap-0.5 rounded-2xl bg-bg py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
              <span aria-hidden="true" className={`size-2 rounded-full ${MACRO_DOT[key]}`} />
              {tAll(`product.${key}`)}
            </span>
            <span className="text-lg font-extrabold">{format.number(grams)} g</span>
          </li>
        ))}
      </ul>
      <Link href="/metabolism" className="text-center font-semibold text-primary underline-offset-4 hover:underline">
        {t("metabolismLink")}
      </Link>
    </GoalScreen>
  );
}
