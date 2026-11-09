import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { COACH_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { trainingStreak } from "@/domain/training/program";
import {
  MARK_KINDS,
  type MarkKind,
  type MarkUnit,
  markKind,
  progressMarks,
  suiviLine,
} from "@/domain/training/progress";
import { DeleteSessionButton } from "@/features/training/delete-session-button";
import { EffortBars } from "@/features/training/effort-bars";
import { ExerciseArt } from "@/features/training/exercise-art";
import { PepinSays } from "@/features/training/pepin-says";
import { Sparkline } from "@/features/training/sparkline";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { trainingHistory, trainingWeeks } from "@/server/training";
import { buttonClass } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { formatDay } from "@/ui/format-date";

const WEEKS_SHOWN = 8;
/** Au-delà, les points d'une semaine se tassent : 4 suffisent pour lire la régularité. */
const DOTS_PER_WEEK = 4;

const cardClass = "flex flex-col rounded-[var(--radius-card)] bg-surface p-4 lg:p-5";

export default async function TrainingHistoryPage({ params, searchParams }: PageProps<"/[locale]/training/history">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const query = await searchParams;
  const kind = MARK_KINDS.includes(query.reperes as MarkKind) ? (query.reperes as MarkKind) : null;
  const [sessions, weeks] = await Promise.all([trainingHistory(user.id, 365), trainingWeeks(user.id)]);
  const t = await getTranslations("training");
  const format = await getFormatter();

  const weekStart = isoWeekStart(today);
  const streak = trainingStreak(weeks, weekStart);
  const weekStarts = Array.from({ length: WEEKS_SHOWN }, (_, index) =>
    addDays(weekStart, (index - WEEKS_SHOWN + 1) * 7),
  );
  const perWeek = new Map<string, number>();
  for (const session of sessions) {
    const week = isoWeekStart(session.date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }

  const shortWeek = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", timeZone: "UTC" });
  const marks = progressMarks(sessions, (id) => exerciseById(id)?.phase === "main");
  const shownMarks = kind
    ? marks.filter((mark) => {
        const exercise = exerciseById(mark.exerciseId);
        return exercise && markKind(exercise.muscle) === kind;
      })
    : marks;
  const value = (unit: MarkUnit, amount: number) =>
    unit === "kg"
      ? t("session.markKg", { value: format.number(amount) })
      : unit === "reps"
        ? t("session.markReps", { value: amount })
        : t("session.markSeconds", { value: amount });
  const line = suiviLine(sessions.length, marks);
  const pepinLine =
    line.key === "none"
      ? t("history.pepinNone")
      : line.key === "steady"
        ? t("history.pepinSteady", { count: line.sessions })
        : t("history.pepinProgress", {
            exercise: exerciseById(line.mark.exerciseId)?.name.toLowerCase() ?? "",
            from: value(line.mark.unit, line.mark.first),
            to: value(line.mark.unit, line.mark.best),
          });
  const chip = (active: boolean) =>
    `flex min-h-10 shrink-0 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${
      active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-text"
    }`;

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("history.title")}</h1>
      <div
        data-wide
        className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-6"
      >
        <PepinSays says={t("pepin.says", { name: COACH_NAME })} className="lg:col-start-1">
          {pepinLine}
        </PepinSays>

        <section aria-labelledby="regularity-title" className={`${cardClass} gap-3 lg:col-start-1`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="regularity-title" className="text-lg font-bold">
              {t("history.regularity")}
            </h2>
            <span className="rounded-full bg-pomme-soft px-3 py-1 text-sm font-semibold">
              {streak > 0 ? t("home.weeksActive", { count: streak }) : t("home.streak", { count: 0 })}
            </span>
          </div>
          <ol className="grid grid-cols-8 items-end gap-1">
            {weekStarts.map((week) => {
              const count = perWeek.get(week) ?? 0;
              const label = t("history.weekLabel", { date: formatDay(week, locale, "short"), count });
              return (
                <li key={week} aria-label={label} title={label} className="flex flex-col items-center gap-1.5">
                  <span aria-hidden="true" className="flex h-20 flex-col-reverse items-center gap-1">
                    {count === 0 ? (
                      <span className="size-3.5 rounded-full border-2 border-dashed border-border" />
                    ) : (
                      Array.from({ length: Math.min(count, DOTS_PER_WEEK) }, (_, dot) => (
                        <span key={dot} className="size-3.5 rounded-full bg-primary" />
                      ))
                    )}
                  </span>
                  <span aria-hidden="true" className="text-[0.7rem] whitespace-nowrap text-text-muted tabular-nums">
                    {shortWeek.format(new Date(`${week}T00:00:00Z`))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="marks-title"
          className={`${cardClass} gap-3 pb-2 lg:col-start-2 lg:row-span-3 lg:row-start-1`}
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="marks-title" className="text-lg font-bold">
              {t("history.marks")}
            </h2>
            <p className="text-sm text-text-muted">{t("history.marksHint")}</p>
          </div>
          {marks.length === 0 ? (
            <p className="pb-2 text-text-muted">{t("history.noRecords")}</p>
          ) : (
            <>
              <nav aria-label={t("history.kindsLabel")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                <ul className="flex gap-2 lg:flex-wrap">
                  {[null, ...MARK_KINDS].map((option) => (
                    <li key={option ?? "all"}>
                      <Link
                        href={{ pathname: "/training/history", query: option ? { reperes: option } : {} }}
                        aria-current={kind === option ? "true" : undefined}
                        scroll={false}
                        className={chip(kind === option)}
                      >
                        {t(`history.kinds.${option ?? "all"}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              {shownMarks.length === 0 ? (
                <p className="py-2 text-text-muted">{t("history.noMarksKind")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {shownMarks.map((mark) => {
                    const exercise = exerciseById(mark.exerciseId);
                    if (!exercise) return null;
                    const gain = mark.best - mark.first;
                    return (
                      <li key={mark.exerciseId}>
                        <Link
                          href={`/training/library/${exercise.id}`}
                          className="flex items-center gap-3 py-2.5 [@media(hover:hover)]:hover:text-primary"
                        >
                          <ExerciseArt
                            exerciseId={exercise.id}
                            muscle={exercise.muscle}
                            size={48}
                            className="rounded-xl"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-semibold">{exercise.name}</span>
                            {mark.points.length > 1 && <Sparkline points={mark.points} />}
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="font-display text-xl font-extrabold tabular-nums">
                              {value(mark.unit, mark.best)}
                            </span>
                            <span className={`text-xs font-semibold ${gain > 0 ? "text-primary" : "text-text-muted"}`}>
                              {gain > 0
                                ? t("history.markGain", { value: value(mark.unit, gain) })
                                : t("history.markFirst")}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="sessions-title" className={`${cardClass} gap-2 pb-2 lg:col-start-1`}>
          <h2 id="sessions-title" className="text-lg font-bold">
            {t("history.sessions")}
          </h2>
          {sessions.length === 0 ? (
            <EmptyState
              scene="dumbbell"
              action={
                <Link href="/training" className={buttonClass("secondary")}>
                  {t("history.start")}
                </Link>
              }
            >
              {t("history.none")}
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sessions.map((session) => {
                const date = formatDay(session.date, locale);
                return (
                  <li key={session.id} className="flex items-center gap-2 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm text-text-muted first-letter:uppercase">{date}</span>
                      <span className="font-semibold">{session.title}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
                        {t("history.summary", { minutes: session.durationMin, kcal: session.kcal })}
                        {session.feeling && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-3.5">
                              <EffortBars feeling={session.feeling} small />
                            </span>
                            {t(`session.feelings.${session.feeling}`)}
                          </span>
                        )}
                      </span>
                    </span>
                    <DeleteSessionButton id={session.id} label={date} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
