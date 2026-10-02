"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { APP_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { checkTargetWeight, computePlan, minHealthyWeightKg, type Plan } from "@/domain/energy";
import {
  ACTIVITY_LEVELS,
  type ActivityLevel,
  allowedGoals,
  type Diet,
  DIETS,
  type Goal,
  goalChangesWeight,
  isMinor,
  type Pace,
  PACES,
  type Sex,
  SEXES,
} from "@/domain/profile";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Field } from "@/ui/field";
import { OptionList } from "@/ui/option-list";

import { previewPlanAction, saveOnboardingAction } from "./actions";
import type { OnboardingInput } from "./schema";

type Draft = {
  firstName: string;
  sex: Sex | null;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goal: Goal | null;
  targetWeightKg: string;
  activityLevel: ActivityLevel | null;
  pace: Pace;
  diet: Diet | null;
  foodsToAvoid: string;
  mealTimes: { breakfast: string; lunch: string; dinner: string };
  disclaimerAccepted: boolean;
};

type Step =
  | "firstName"
  | "sex"
  | "birthDate"
  | "height"
  | "weight"
  | "goal"
  | "targetWeight"
  | "activity"
  | "pace"
  | "diet"
  | "meals"
  | "disclaimer"
  | "summary";

const INITIAL: Draft = {
  firstName: "",
  sex: null,
  birthDate: "",
  heightCm: "",
  weightKg: "",
  goal: null,
  targetWeightKg: "",
  activityLevel: null,
  pace: "gentle",
  diet: null,
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "19:30" },
  disclaimerAccepted: false,
};

function toNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

function toInput(draft: Draft): OnboardingInput {
  return {
    firstName: draft.firstName,
    sex: draft.sex!,
    birthDate: draft.birthDate,
    heightCm: Math.round(toNumber(draft.heightCm) ?? 0),
    weightKg: toNumber(draft.weightKg) ?? 0,
    goal: draft.goal!,
    targetWeightKg: draft.goal && goalChangesWeight(draft.goal) ? toNumber(draft.targetWeightKg) : null,
    activityLevel: draft.activityLevel!,
    pace: draft.pace,
    diet: draft.diet!,
    foodsToAvoid: draft.foodsToAvoid,
    mealTimes: draft.mealTimes,
    disclaimerAccepted: draft.disclaimerAccepted as true,
  };
}

/** Message d'erreur (code `errors.*`) de l'étape courante, ou `null` si on peut continuer. */
function validateStep(step: Step, draft: Draft, today: string): string | null {
  switch (step) {
    case "firstName":
      return draft.firstName.trim() ? null : "required";
    case "sex":
      return draft.sex ? null : "required";
    case "birthDate":
      return /^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) && draft.birthDate <= today && draft.birthDate >= "1900-01-01"
        ? null
        : "invalid_date";
    case "height": {
      const value = toNumber(draft.heightCm);
      return value != null && value >= 120 && value <= 230 ? null : "height_range";
    }
    case "weight": {
      const value = toNumber(draft.weightKg);
      return value != null && value >= 30 && value <= 300 ? null : "weight_range";
    }
    case "goal":
      return draft.goal && allowedGoals(draft.birthDate, today).includes(draft.goal) ? null : "required";
    case "targetWeight": {
      const target = toNumber(draft.targetWeightKg);
      if (target == null) return null;
      if (target < 30 || target > 300) return "weight_range";
      return checkTargetWeight(draft.goal!, toNumber(draft.weightKg)!, toNumber(draft.heightCm)!, target);
    }
    case "activity":
      return draft.activityLevel ? null : "required";
    case "diet":
      return draft.diet ? null : "required";
    case "meals":
      return Object.values(draft.mealTimes).every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        ? null
        : "invalid_time";
    case "disclaimer":
      return draft.disclaimerAccepted ? null : "disclaimer_required";
    default:
      return null;
  }
}

export function OnboardingWizard({ defaultFirstName }: { defaultFirstName: string }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const format = useFormatter();
  const errorText = useErrorText();
  const today = todayIso();

  const [draft, setDraft] = useState<Draft>({ ...INITIAL, firstName: defaultFirstName });
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = useMemo<Step[]>(() => {
    const changesWeight = draft.goal != null && goalChangesWeight(draft.goal);
    const list: Step[] = ["firstName", "sex", "birthDate", "height", "weight", "goal"];
    if (changesWeight) list.push("targetWeight");
    list.push("activity");
    if (changesWeight) list.push("pace");
    list.push("diet", "meals", "disclaimer", "summary");
    return list;
  }, [draft.goal]);

  const step = steps[index]!;
  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  // Accessibilité : le titre de chaque nouvel écran reçoit le focus.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const formatDate = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "long" });

  function next() {
    const problem = validateStep(step, draft, today);
    if (problem) {
      setError(problem);
      return;
    }
    if (steps[index + 1] === "summary") {
      startTransition(async () => {
        const result = await previewPlanAction(toInput(draft));
        if (result && "plan" in result) {
          setPlan(result.plan);
          setIndex(index + 1);
        } else {
          setError(result?.error ?? "generic");
        }
      });
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    setError(null);
    setIndex(Math.max(0, index - 1));
  }

  function start() {
    startTransition(async () => {
      const result = await saveOnboardingAction(toInput(draft));
      if (result?.error) setError(result.error);
    });
  }

  const minor = draft.birthDate ? isMinor(draft.birthDate, today) : false;
  const errorMessage =
    error === "below_healthy_bmi"
      ? errorText(error, { min: format.number(minHealthyWeightKg(toNumber(draft.heightCm) ?? 0)) })
      : errorText(error);
  const total = steps.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-text-muted">{t("progress", { current: index + 1, total })}</p>
        <div
          role="progressbar"
          aria-label={t("progress", { current: index + 1, total })}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "summary") start();
          else next();
        }}
      >
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          {step === "summary" ? t("summary.title") : t(`${step}.title`)}
        </h1>

        {step === "firstName" && (
          <Field
            label={t("firstName.label")}
            value={draft.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            autoComplete="given-name"
            error={errorMessage}
          />
        )}

        {step === "sex" && (
          <>
            <p className="text-text-muted">{t("sex.hint")}</p>
            <OptionList
              legend={t("sex.title")}
              hideLegend
              name="sex"
              value={draft.sex}
              onChange={(sex) => update({ sex })}
              options={SEXES.map((value) => ({ value, label: t(`sex.${value}`) }))}
            />
          </>
        )}

        {step === "birthDate" && (
          <Field
            label={t("birthDate.label")}
            type="date"
            max={today}
            value={draft.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
            autoComplete="bday"
            error={errorMessage}
          />
        )}

        {step === "height" && (
          <Field
            label={t("height.label")}
            inputMode="numeric"
            value={draft.heightCm}
            onChange={(e) => update({ heightCm: e.target.value })}
            error={errorMessage}
          />
        )}

        {step === "weight" && (
          <Field
            label={t("weight.label")}
            inputMode="decimal"
            value={draft.weightKg}
            onChange={(e) => update({ weightKg: e.target.value })}
            error={errorMessage}
          />
        )}

        {step === "goal" && (
          <>
            {minor && <Alert tone="info">{t("goal.minorHint")}</Alert>}
            <OptionList
              legend={t("goal.title")}
              hideLegend
              name="goal"
              value={draft.goal}
              onChange={(goal) => update({ goal })}
              options={allowedGoals(draft.birthDate, today).map((value) => ({ value, label: t(`goal.${value}`) }))}
            />
          </>
        )}

        {step === "targetWeight" && (
          <>
            <Field
              label={t("targetWeight.label")}
              hint={t("targetWeight.hint")}
              inputMode="decimal"
              value={draft.targetWeightKg}
              onChange={(e) => update({ targetWeightKg: e.target.value })}
              error={errorMessage}
            />
            <Button variant="ghost" onClick={() => (update({ targetWeightKg: "" }), setIndex(index + 1))}>
              {t("targetWeight.skip")}
            </Button>
          </>
        )}

        {step === "activity" && (
          <OptionList
            legend={t("activity.title")}
            hideLegend
            name="activity"
            value={draft.activityLevel}
            onChange={(activityLevel) => update({ activityLevel })}
            options={ACTIVITY_LEVELS.map((level) => ({
              value: level,
              label: t(`activity.${level}.label`),
              hint: t(`activity.${level}.hint`),
            }))}
          />
        )}

        {step === "pace" && (
          <PaceStep draft={draft} today={today} onChange={(pace) => update({ pace })} formatDate={formatDate} />
        )}

        {step === "diet" && (
          <>
            <OptionList
              legend={t("diet.title")}
              hideLegend
              name="diet"
              value={draft.diet}
              onChange={(diet) => update({ diet })}
              options={DIETS.map((value) => ({ value, label: t(`diet.${value}`) }))}
            />
            <Field
              label={t("diet.avoidLabel")}
              hint={t("diet.avoidHint")}
              value={draft.foodsToAvoid}
              onChange={(e) => update({ foodsToAvoid: e.target.value })}
              maxLength={500}
            />
          </>
        )}

        {step === "meals" && (
          <>
            <p className="text-text-muted">{t("meals.hint")}</p>
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
              <Field
                key={meal}
                label={t(`meals.${meal}`)}
                type="time"
                value={draft.mealTimes[meal]}
                onChange={(e) => update({ mealTimes: { ...draft.mealTimes, [meal]: e.target.value } })}
              />
            ))}
          </>
        )}

        {step === "disclaimer" && (
          <>
            <p className="text-lg">{t("disclaimer.body", { appName: APP_NAME })}</p>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4">
              <input
                type="checkbox"
                checked={draft.disclaimerAccepted}
                onChange={(e) => update({ disclaimerAccepted: e.target.checked })}
                className="size-5 accent-[var(--color-primary)]"
              />
              <span className="font-semibold">{t("disclaimer.accept")}</span>
            </label>
          </>
        )}

        {step === "summary" && plan && <Summary plan={plan} goal={draft.goal!} formatDate={formatDate} />}

        {error && !["firstName", "birthDate", "height", "weight", "targetWeight"].includes(step) && (
          <Alert>{errorMessage}</Alert>
        )}

        <div className="flex gap-3">
          {index > 0 && (
            <Button variant="secondary" onClick={back} disabled={pending}>
              {tc("back")}
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={pending}>
            {step === "summary" ? t("summary.start") : tc("continue")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaceStep({
  draft,
  today,
  onChange,
  formatDate,
}: {
  draft: Draft;
  today: string;
  onChange: (pace: Pace) => void;
  formatDate: (iso: string) => string;
}) {
  const t = useTranslations("onboarding.pace");
  const losing = draft.goal === "lose_weight";
  // Estimation indicative avec les planchers par défaut ; le serveur fait le calcul final.
  const eta = (pace: Pace) => computePlan({ ...toInput({ ...draft, pace }), today }).estimatedGoalDate;
  return (
    <OptionList
      legend={t("title")}
      hideLegend
      name="pace"
      value={draft.pace}
      onChange={onChange}
      options={PACES.map((pace) => {
        const date = eta(pace);
        const detail = t(`${pace}${losing ? "Loss" : "Gain"}`);
        return {
          value: pace,
          label: t(pace),
          hint: date ? `${detail} · ${t("eta", { date: formatDate(date) })}` : detail,
        };
      })}
    />
  );
}

function Summary({ plan, goal, formatDate }: { plan: Plan; goal: Goal; formatDate: (iso: string) => string }) {
  const t = useTranslations("onboarding.summary");
  const th = useTranslations("home");
  const tc = useTranslations("common");
  const format = useFormatter();
  const n = (value: number) => format.number(value);
  const explanation =
    goal === "lose_weight"
      ? t("lose", {
          kg: format.number(Math.abs(plan.weeklyChangeKg), { maximumFractionDigits: 2 }),
          kcal: n(plan.kcal),
        })
      : goal === "gain_muscle"
        ? t("gain", { kcal: n(plan.kcal) })
        : t("maintain", { kcal: n(plan.kcal) });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="font-semibold text-text-muted">{t("kcal")}</h2>
        <p className="font-display text-5xl font-semibold">{tc("kcal", { value: plan.kcal })}</p>
        <h3 className="font-semibold text-text-muted">{t("macros")}</h3>
        <ul className="grid grid-cols-3 gap-3">
          {(
            [
              ["protein", plan.macros.proteinG, "bg-protein"],
              ["carbs", plan.macros.carbsG, "bg-carbs"],
              ["fat", plan.macros.fatG, "bg-fat"],
            ] as const
          ).map(([key, value, color]) => (
            <li key={key} className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className={`size-3 rounded-full ${color}`} />
                {th(key)}
              </span>
              <span className="text-xl font-semibold">{tc("grams", { value })}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">{t("howTitle")}</h2>
        <p>{t("bmr", { bmr: n(plan.bmr) })}</p>
        <p>{t("tdee", { tdee: n(plan.tdee) })}</p>
        <p>{explanation}</p>
        {plan.notices.includes("loss_capped") && <p>{t("capped")}</p>}
        {plan.notices.includes("floor_applied") && <p>{t("floor", { floor: n(plan.kcal) })}</p>}
        {plan.estimatedGoalDate && <p>{t("eta", { date: formatDate(plan.estimatedGoalDate) })}</p>}
        <p className="text-text-muted">{t("adaptive")}</p>
      </Card>
    </div>
  );
}
