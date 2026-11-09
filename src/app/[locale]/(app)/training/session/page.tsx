import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { fallbackTitleIndex } from "@/domain/training/pepin";
import { personalRecords, trainingStreak } from "@/domain/training/program";
import { FOCUSES, type Focus, type PlannedSession } from "@/domain/training/types";
import { type PlayerSession, type PlayerStep, SessionPlayer } from "@/features/training/session-player";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { getTrainingProfile, type SessionSpec, sessionFor, trainingHistory, trainingWeeks } from "@/server/training";
import { Card } from "@/ui/card";

function intParam(value: unknown, min: number, max: number): number | null {
  const number = Number(typeof value === "string" ? value : NaN);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

/** Séance demandée par l'adresse : jour du programme (et variante), express ou à la demande. */
function specFrom(query: Record<string, string | string[] | undefined>): SessionSpec | null {
  if (query.express) return { kind: "express" };
  const minutes = intParam(query.minutes, 10, 60);
  if (minutes !== null) {
    const focus = FOCUSES.includes(query.focus as Focus) ? (query.focus as Focus) : "full_body";
    return { kind: "on_demand", minutes, focus, noEquipment: query.noEquipment === "1" };
  }
  const day = intParam(query.day, 0, 6);
  if (day === null) return null;
  return { kind: "program", day, variant: intParam(query.variant, 0, 20) ?? 0 };
}

function toSteps(session: PlannedSession): PlayerStep[] {
  const phases = [
    ["warmup", session.warmup],
    ["main", session.main],
    ["cooldown", session.cooldown],
  ] as const;
  return phases.flatMap(([phase, items]) =>
    items.flatMap((item) => {
      const exercise = exerciseById(item.exerciseId);
      if (!exercise) return [];
      return [
        {
          phase,
          exerciseId: exercise.id,
          name: exercise.name,
          muscle: exercise.muscle,
          steps: exercise.steps,
          mistakes: exercise.mistakes,
          easier: exercise.easier,
          harder: exercise.harder,
          usesLoad: exercise.equipment.some((item) =>
            ["dumbbells", "kettlebell", "barbell", "machines"].includes(item),
          ),
          sets: item.sets,
          reps: item.reps,
          seconds: item.seconds,
          restSeconds: item.restSeconds,
        },
      ];
    }),
  );
}

export default async function TrainingSessionPage({ params, searchParams }: PageProps<"/[locale]/training/session">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (!(await getTrainingProfile(user.id))) return redirect({ href: "/training/setup", locale });
  const spec = specFrom(await searchParams);
  const session = spec ? await sessionFor(user.id, spec, todayIso()) : null;
  const t = await getTranslations("training");

  if (!spec || !session) {
    return (
      <Card>
        <p>{t("session.unavailable")}</p>
        <Link href="/training" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("title")}
        </Link>
      </Card>
    );
  }

  const kind: PlayerSession["kind"] =
    spec.kind === "program" ? ((spec.variant ?? 0) > 0 ? "replacement" : "program") : spec.kind;
  const title =
    kind === "express"
      ? t("home.express")
      : (kind === "program" && session.title) ||
        t(`titles.${session.focus}.${String(fallbackTitleIndex(session.day)) as "0"}`);
  const steps = toSteps(session);
  const ids = new Set(steps.map((step) => step.exerciseId));
  const [history, weeks, profile] = await Promise.all([
    trainingHistory(user.id, 3650),
    trainingWeeks(user.id),
    getProfile(user.id),
  ]);
  const weekStart = isoWeekStart(todayIso());

  return (
    <div data-wide className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-5xl">
      <SessionPlayer
        session={{
          kind,
          focus: session.focus,
          title,
          minutes: session.minutes,
          tip: kind === "program" ? (session.tip ?? null) : null,
          steps,
          firstSession: weeks.size === 0,
          weeksIfDone: trainingStreak(new Set([...weeks, weekStart]), weekStart),
          firstName: profile?.firstName ?? user.name,
          records: personalRecords(history).filter((record) => ids.has(record.exerciseId)),
        }}
      />
      <p className="text-sm text-text-muted">{t("disclaimer")}</p>
    </div>
  );
}
