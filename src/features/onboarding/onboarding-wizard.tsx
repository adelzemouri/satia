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
  type BudgetMode,
  COACH_STYLES,
  type CoachStyle,
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
import { CoachAvatar } from "@/features/coach/coach-avatar";
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
  budgetMode: BudgetMode;
  coachStyle: CoachStyle;
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
  | "coach"
  | "disclaimer"
  | "summary";

/** Écrans de l'onboarding : chacun regroupe quelques questions, présentées par Pépin. */
type PageKey = "you" | "body" | "goal" | "rhythm" | "habits" | "coach" | "summary";
type Page = { key: PageKey; steps: Step[] };

/** Étapes dont l'erreur s'affiche sous le champ lui-même plutôt qu'en message. */
const FIELD_STEPS: readonly Step[] = ["firstName", "birthDate", "height", "weight", "targetWeight"];

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
  // Le régime le plus courant est déjà coché : on le change si besoin, sans message d'erreur.
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "19:30" },
  budgetMode: "daily",
  coachStyle: "teacher",
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
    budgetMode: draft.budgetMode,
    coachStyle: draft.coachStyle,
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
  const tcoach = useTranslations("coach");
  const format = useFormatter();
  const errorText = useErrorText();
  const today = todayIso();

  const [draft, setDraft] = useState<Draft>({ ...INITIAL, firstName: defaultFirstName });
  const [index, setIndex] = useState(0);
  /** Erreur en cours et l'étape qu'elle concerne (aucune pour une erreur du serveur). */
  const [error, setError] = useState<{ code: string; step: Step | null } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const pages = useMemo<Page[]>(() => {
    const changesWeight = draft.goal != null && goalChangesWeight(draft.goal);
    return [
      { key: "you", steps: ["firstName", "sex", "birthDate"] },
      { key: "body", steps: ["height", "weight"] },
      { key: "goal", steps: changesWeight ? ["goal", "targetWeight"] : ["goal"] },
      { key: "rhythm", steps: changesWeight ? ["activity", "pace"] : ["activity"] },
      { key: "habits", steps: ["diet", "meals"] },
      { key: "coach", steps: ["coach", "disclaimer"] },
      { key: "summary", steps: ["summary"] },
    ];
  }, [draft.goal]);

  const page = pages[index]!;
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
    for (const step of page.steps) {
      const problem = validateStep(step, draft, today);
      if (problem) {
        setError({ code: problem, step });
        return;
      }
    }
    if (pages[index + 1]?.key === "summary") {
      startTransition(async () => {
        const result = await previewPlanAction(toInput(draft));
        if (result && "plan" in result) {
          setPlan(result.plan);
          setIndex(index + 1);
        } else {
          setError({ code: result?.error ?? "generic", step: null });
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
      if (result?.error) setError({ code: result.error, step: null });
    });
  }

  const minor = draft.birthDate ? isMinor(draft.birthDate, today) : false;
  const errorMessage =
    error?.code === "below_healthy_bmi"
      ? errorText(error.code, { min: format.number(minHealthyWeightKg(toNumber(draft.heightCm) ?? 0)) })
      : errorText(error?.code ?? null);
  /** Message d'erreur à afficher sous le champ de cette étape. */
  const fieldError = (step: Step) => (error?.step === step ? errorMessage : undefined);
  const total = pages.length;
  const summary = page.key === "summary";

  /** Contenu d'une question ; l'erreur d'une question à choix s'affiche juste en dessous. */
  function renderStep(step: Step) {
    switch (step) {
      case "firstName":
        return (
          <Field
            label={t("firstName.label")}
            value={draft.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            autoComplete="given-name"
            error={fieldError("firstName")}
          />
        );
      case "sex":
        return (
          <>
            <OptionList
              legend={t("sex.title")}
              name="sex"
              value={draft.sex}
              onChange={(sex) => update({ sex })}
              options={SEXES.map((value) => ({ value, label: t(`sex.${value}`) }))}
            />
            <p className="-mt-2 text-sm text-text-muted">{t("sex.hint")}</p>
          </>
        );
      case "birthDate":
        return (
          <Field
            label={t("birthDate.label")}
            type="date"
            max={today}
            value={draft.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
            autoComplete="bday"
            error={fieldError("birthDate")}
          />
        );
      case "height":
        return (
          <Field
            label={t("height.label")}
            inputMode="numeric"
            value={draft.heightCm}
            onChange={(e) => update({ heightCm: e.target.value })}
            error={fieldError("height")}
          />
        );
      case "weight":
        return (
          <Field
            label={t("weight.label")}
            inputMode="decimal"
            value={draft.weightKg}
            onChange={(e) => update({ weightKg: e.target.value })}
            error={fieldError("weight")}
          />
        );
      case "goal":
        return (
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
        );
      case "targetWeight":
        return (
          <Field
            label={t("targetWeight.label")}
            hint={t("targetWeight.hint")}
            inputMode="decimal"
            value={draft.targetWeightKg}
            onChange={(e) => update({ targetWeightKg: e.target.value })}
            error={fieldError("targetWeight")}
          />
        );
      case "activity":
        return (
          <OptionList
            legend={t("activity.title")}
            name="activity"
            value={draft.activityLevel}
            onChange={(activityLevel) => update({ activityLevel })}
            options={ACTIVITY_LEVELS.map((level) => ({
              value: level,
              label: t(`activity.${level}.label`),
              hint: t(`activity.${level}.hint`),
            }))}
          />
        );
      case "pace":
        // Le rythme et sa date estimée dépendent du niveau d'activité : on attend qu'il soit choisi.
        return draft.activityLevel ? (
          <PaceStep draft={draft} today={today} onChange={(pace) => update({ pace })} formatDate={formatDate} />
        ) : null;
      case "diet":
        return (
          <>
            <OptionList
              legend={t("diet.title")}
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
        );
      case "meals":
        return (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{t("meals.title")}</legend>
            <p className="text-sm text-text-muted">{t("meals.hint")}</p>
            <div className="grid grid-cols-3 gap-3">
              {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
                <Field
                  key={meal}
                  label={t(`meals.${meal}`)}
                  type="time"
                  value={draft.mealTimes[meal]}
                  onChange={(e) => update({ mealTimes: { ...draft.mealTimes, [meal]: e.target.value } })}
                />
              ))}
            </div>
          </fieldset>
        );
      case "coach":
        return (
          <OptionList
            legend={t("coach.title")}
            name="coachStyle"
            value={draft.coachStyle}
            onChange={(coachStyle) => update({ coachStyle })}
            options={COACH_STYLES.map((value) => ({
              value,
              label: tcoach(`styles.${value}.label`),
              hint: tcoach(`styles.${value}.hint`),
            }))}
          />
        );
      case "disclaimer":
        return (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
            <p>{t("disclaimer.body", { appName: APP_NAME })}</p>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-bg px-4">
              <input
                type="checkbox"
                checked={draft.disclaimerAccepted}
                onChange={(e) => update({ disclaimerAccepted: e.target.checked })}
                className="size-5 accent-[var(--color-primary)]"
              />
              <span className="font-semibold">{t("disclaimer.accept")}</span>
            </label>
          </div>
        );
      case "summary":
        return plan && <Summary plan={plan} goal={draft.goal!} formatDate={formatDate} />;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="progressbar"
        aria-label={t("progress", { current: index + 1, total })}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        className="flex justify-center gap-1.5"
      >
        {pages.map((item, position) => (
          <span
            key={item.key}
            className={`h-2 rounded-full transition-all ${position === index ? "w-6 bg-primary" : position < index ? "w-2 bg-primary" : "w-2 bg-border"}`}
          />
        ))}
      </div>

      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (summary) start();
          else next();
        }}
      >
        <div key={page.key} className="checkin-in flex flex-col items-center gap-3 text-center">
          <CoachAvatar size={index === 0 ? 80 : 56} />
          <p className="relative max-w-sm rounded-2xl bg-surface px-4 py-3 text-sm">
            {t(`pages.${page.key}.pepin`, { name: draft.firstName.trim() || defaultFirstName })}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-3xl font-extrabold tracking-tight outline-none"
          >
            {summary ? t("summary.title") : t(`pages.${page.key}.title`)}
          </h1>
        </div>

        {page.steps.map((step) => (
          <section key={step} className="flex flex-col gap-3">
            {renderStep(step)}
            {error?.step === step && !FIELD_STEPS.includes(step) && <Alert>{errorMessage}</Alert>}
          </section>
        ))}

        {error && error.step === null && <Alert>{errorMessage}</Alert>}

        <div className="flex gap-3">
          {index > 0 && (
            <Button variant="secondary" onClick={back} disabled={pending}>
              {tc("back")}
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={pending}>
            {summary ? t("summary.start") : tc("continue")}
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
        <p className="font-display text-5xl font-extrabold tracking-tight">{tc("kcal", { value: plan.kcal })}</p>
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
