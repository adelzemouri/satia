import { getTranslations, setRequestLocale } from "next-intl/server";

import { COACH_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { fallbackTitleIndex, homeLine } from "@/domain/training/pepin";
import { trainingStreak } from "@/domain/training/program";
import type { PlannedSession } from "@/domain/training/types";
import { weekDates } from "@/domain/weekly-budget";
import { ExerciseAnimation } from "@/features/training/exercise-animation";
import { ExerciseArt } from "@/features/training/exercise-art";
import { OnDemandRow } from "@/features/training/on-demand-row";
import { OtherRow } from "@/features/training/other-row";
import { PepinSays } from "@/features/training/pepin-says";
import { PersonalizeLoader } from "@/features/training/personalize-loader";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import {
  ensureProgram,
  getTrainingProfile,
  sessionFor,
  todayFromProgram,
  trainingHistory,
  trainingWeeks,
} from "@/server/training";
import { weekdayOf } from "@/server/training-day";
import { buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

const SEQUENCE_SHOWN = 4;

function variantParam(value: unknown): number {
  const number = Number(typeof value === "string" ? value : 0);
  return Number.isInteger(number) && number >= 0 && number <= 20 ? number : 0;
}

export default async function TrainingPage({ params, searchParams }: PageProps<"/[locale]/training">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getTrainingProfile(user.id);
  if (!profile) return redirect({ href: "/training/setup", locale });

  const today = todayIso();
  const weekStart = isoWeekStart(today);
  const weekday = weekdayOf(today);
  const variant = variantParam((await searchParams).variant);
  const [program, history, weeks, ai, nutrition] = await Promise.all([
    ensureProgram(user.id, weekStart),
    trainingHistory(user.id, 7),
    trainingWeeks(user.id),
    aiAvailability(),
    getProfile(user.id),
  ]);
  const planned = todayFromProgram(program, today);
  const shown =
    planned && variant > 0 ? await sessionFor(user.id, { kind: "program", day: planned.day!, variant }) : planned;
  const doneToday = history.filter((session) => session.date === today);
  const doneDates = new Set(history.map((session) => session.date));
  const streak = trainingStreak(weeks, weekStart);
  const t = await getTranslations("training");
  const dayName = (day: number) => t(`weekdays.${String(day) as "0"}`);
  const titleOf = (session: PlannedSession, useCoachTitle: boolean) =>
    (useCoachTitle && session.title) || t(`titles.${session.focus}.${String(fallbackTitleIndex(session.day)) as "0"}`);

  const line = homeLine({
    date: today,
    today: weekday,
    doneToday: doneToday.length > 0,
    everTrained: weeks.size > 0,
    sessions: program.sessions,
  });
  const pepinLine =
    line.key === "today"
      ? program.intro || t(`pepin.today.${String(line.variant) as "0"}`)
      : line.key === "done"
        ? t("pepin.done", { kcal: doneToday.reduce((sum, session) => sum + session.kcal, 0) })
        : line.key === "firstLater"
          ? t("pepin.firstLater", { day: dayName(line.day).toLowerCase() })
          : line.key === "rest"
            ? line.next === null
              ? t("pepin.rest")
              : t("pepin.restNext", { day: dayName(line.next).toLowerCase() })
            : t("pepin.first");
  const snack =
    doneToday.length > 0
      ? t(nutrition?.diet === "vegan" ? "pepin.snackAfterPlant" : "pepin.snackAfter")
      : shown
        ? t("pepin.snackBefore")
        : null;
  const says = t("pepin.says", { name: COACH_NAME });
  const lead = shown ? exerciseById(shown.main[0]?.exerciseId ?? "") : undefined;
  const linkClass = "text-sm font-semibold text-primary underline-offset-4 hover:underline";

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <Link
          href="/training/setup"
          aria-label={t("home.profile")}
          title={t("home.profile")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-text [@media(hover:hover)]:hover:text-primary"
        >
          <Icon name="profile" />
        </Link>
      </div>

      <div
        data-wide
        className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start"
      >
        <div className="flex flex-col gap-4">
          <PepinSays says={says}>{pepinLine}</PepinSays>
          {ai?.available && !program.personalized && <PersonalizeLoader />}

          {shown && (
            <section
              aria-label={variant > 0 ? t("home.replaced") : t("home.today")}
              className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4 lg:p-5"
            >
              <div className="relative flex h-52 justify-center rounded-2xl bg-primary-soft lg:h-72">
                {lead && (
                  <ExerciseAnimation
                    exerciseId={lead.id}
                    muscle={lead.muscle}
                    name={lead.name}
                    className="aspect-square h-full"
                  />
                )}
                <span className="absolute top-3 left-3 rounded-full bg-surface px-3 py-1 text-xs font-bold">
                  {variant > 0 ? t("home.replaced") : t("home.todayTag", { day: dayName(weekday).toLowerCase() })}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">
                  {titleOf(shown, variant === 0)}
                </h2>
                <p className="text-text-muted">
                  {t("minutes", { count: shown.minutes })} · {t("exercises", { count: shown.main.length })}
                </p>
              </div>
              <ul className="flex items-center gap-1.5" aria-label={t("session.main")}>
                {shown.main.slice(0, SEQUENCE_SHOWN).map((item) => {
                  const exercise = exerciseById(item.exerciseId);
                  return exercise ? (
                    <li key={item.exerciseId} title={exercise.name}>
                      <ExerciseArt exerciseId={exercise.id} muscle={exercise.muscle} size={44} className="rounded-xl" />
                      <span className="sr-only">{exercise.name}</span>
                    </li>
                  ) : null;
                })}
                {shown.main.length > SEQUENCE_SHOWN && (
                  <li className="pl-1 text-sm font-semibold text-text-muted">
                    {t("home.more", { count: shown.main.length - SEQUENCE_SHOWN })}
                  </li>
                )}
              </ul>
              <Link
                href={{ pathname: "/training/session", query: { day: shown.day!, variant } }}
                className={buttonClass("primary", "w-full")}
              >
                {t("home.start")}
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                <Link href={{ pathname: "/training", query: { variant: variant + 1 } }} className={linkClass}>
                  {t("home.replace")}
                </Link>
                {variant > 0 && (
                  <Link href="/training" className={linkClass}>
                    {t("home.backToPlanned")}
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="week-title"
            className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 lg:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="week-title" className="text-lg font-bold">
                {t("home.myWeek")}
              </h2>
              {streak > 0 ? (
                <span className="rounded-full bg-pomme-soft px-3 py-1 text-sm font-semibold">
                  {t("home.weeksActive", { count: streak })}
                </span>
              ) : (
                <span className="text-sm text-text-muted">{t("home.planned", { count: program.sessions.length })}</span>
              )}
            </div>
            <ol className="grid grid-cols-7 gap-1">
              {weekDates(weekStart).map((date, day) => {
                const session = program.sessions.find((item) => item.day === day);
                const done = doneDates.has(date);
                const isToday = date === today;
                const label = done
                  ? t("home.dayDone", { day: dayName(day) })
                  : session
                    ? t("home.dayPlanned", { day: dayName(day), title: titleOf(session, true) })
                    : t("home.dayRest", { day: dayName(day) });
                return (
                  <li
                    key={date}
                    aria-label={label}
                    aria-current={isToday ? "date" : undefined}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-1 ${isToday ? "bg-primary-soft" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`text-xs font-semibold ${isToday ? "text-primary" : "text-text-muted"}`}
                    >
                      {dayName(day).slice(0, 3)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex size-9 items-center justify-center rounded-full text-sm tabular-nums ${
                        done
                          ? "bg-pomme font-bold text-on-pomme"
                          : session
                            ? "border-[2.5px] border-primary font-bold"
                            : "border-2 border-dashed border-border text-text-muted"
                      }`}
                    >
                      {done ? <Icon name="check" size={16} /> : Number(date.slice(8))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            aria-labelledby="other-title"
            className="flex flex-col rounded-[var(--radius-card)] bg-surface px-4 pt-4 pb-1 lg:px-5"
          >
            <h2 id="other-title" className="text-lg font-bold">
              {t("home.other")}
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              <li>
                <OtherRow
                  icon="timer"
                  title={t("home.expressTitle")}
                  hint={t("home.expressHint")}
                  href={{ pathname: "/training/session", query: { express: 1 } }}
                />
              </li>
              <li>
                <OnDemandRow />
              </li>
              <li>
                <OtherRow icon="book" title={t("home.library")} hint={t("home.libraryHint")} href="/training/library" />
              </li>
              <li>
                <OtherRow
                  icon="chart"
                  title={t("home.history")}
                  hint={t("home.historyHint")}
                  href="/training/history"
                />
              </li>
            </ul>
          </section>

          {snack && (
            <PepinSays says={says} size={32} soft className="text-sm">
              {snack}
            </PepinSays>
          )}
        </div>
      </div>

      <p className="text-sm text-text-muted">{t("disclaimer")}</p>
    </>
  );
}
