import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { trainingStreak } from "@/domain/training/program";
import { weekDates } from "@/domain/weekly-budget";
import { PersonalizeLoader } from "@/features/training/personalize-loader";
import { getPathname, Link, redirect } from "@/i18n/navigation";
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
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { Icon } from "@/ui/icon";

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

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
  const t = await getTranslations("training");
  const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";
  const plant = nutrition?.diet === "vegan";

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("title")} className="flex flex-wrap gap-3">
        {(
          [
            ["/training/library", "book", t("home.library")],
            ["/training/history", "calendar", t("home.history")],
            ["/training/setup", "profile", t("home.profile")],
          ] as const
        ).map(([href, icon, label]) => (
          <Link key={href} href={href} className={buttonClass("secondary", "px-4")}>
            <Icon name={icon} />
            {label}
          </Link>
        ))}
      </nav>
      {program.intro && <p>{program.intro}</p>}
      {ai?.available && !program.personalized && <PersonalizeLoader />}

      <Card aria-labelledby="today-title">
        <h2 id="today-title" className="text-xl font-semibold">
          {variant > 0 ? t("home.replaced") : t("home.today")}
        </h2>
        {doneToday.length > 0 && (
          <p className="rounded-2xl bg-primary-soft px-4 py-3">
            {t("home.doneToday", { kcal: doneToday.reduce((sum, session) => sum + session.kcal, 0) })}
          </p>
        )}
        {shown ? (
          <>
            <p className="font-semibold">
              {(variant === 0 && shown.title) || t(`focus.${shown.focus}`)}
              <span className="font-normal text-text-muted">
                {" · "}
                {t("minutes", { count: shown.minutes })} · {t("exercises", { count: shown.main.length })}
              </span>
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {shown.main.map((item) => (
                <li key={item.exerciseId}>{exerciseById(item.exerciseId)?.name ?? item.exerciseId}</li>
              ))}
            </ul>
            {variant === 0 && shown.tip && <p className="text-text-muted">{shown.tip}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={{ pathname: "/training/session", query: { day: shown.day!, variant } }}
                className={buttonClass("primary")}
              >
                {t("home.start")}
              </Link>
              <Link
                href={{ pathname: "/training", query: { variant: variant + 1 } }}
                className={buttonClass("secondary")}
                aria-describedby="replace-hint"
              >
                {t("home.replace")}
              </Link>
              {variant > 0 && (
                <Link href="/training" className={linkClass}>
                  {t("home.backToPlanned")}
                </Link>
              )}
            </div>
            <p id="replace-hint" className="text-sm text-text-muted">
              {t("home.replaceHint")}
            </p>
          </>
        ) : (
          <p>{t("home.rest")}</p>
        )}
      </Card>

      {(shown || doneToday.length > 0) && (
        <Card aria-labelledby="snack-title">
          <h2 id="snack-title" className="text-lg font-semibold">
            {doneToday.length > 0 ? t("snack.afterTitle") : t("snack.beforeTitle")}
          </h2>
          <p>{doneToday.length > 0 ? t(plant ? "snack.afterPlant" : "snack.after") : t("snack.before")}</p>
        </Card>
      )}

      <Card aria-labelledby="express-title">
        <h2 id="express-title" className="text-lg font-semibold">
          {t("home.express")}
        </h2>
        <p className="text-text-muted">{t("home.expressHint")}</p>
        <Link href={{ pathname: "/training/session", query: { express: 1 } }} className={buttonClass("secondary")}>
          <Icon name="timer" />
          {t("home.express")}
        </Link>
      </Card>

      <Card aria-labelledby="demand-title">
        <h2 id="demand-title" className="text-lg font-semibold">
          {t("home.onDemand")}
        </h2>
        <p className="text-text-muted">{t("home.onDemandHint")}</p>
        <form action={getPathname({ href: "/training/session", locale })} method="get" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("home.duration")}</span>
              <select name="minutes" defaultValue="20" className={selectClass}>
                {[10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {t("minutes", { count: minutes })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("home.type")}</span>
              <select name="focus" defaultValue="full_body" className={selectClass}>
                {(["full_body", "upper", "lower", "cardio", "mobility"] as const).map((focus) => (
                  <option key={focus} value={focus}>
                    {t(`focus.${focus}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" name="noEquipment" value="1" className="size-5 accent-[var(--color-primary)]" />
            {t("home.noEquipment")}
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            {t("home.prepare")}
          </button>
        </form>
      </Card>

      <Card aria-labelledby="week-title">
        <h2 id="week-title" className="text-xl font-semibold">
          {t("home.week")}
        </h2>
        <ul className="flex flex-col divide-y divide-border">
          {weekDates(weekStart).map((date, day) => {
            const session = program.sessions.find((item) => item.day === day);
            return (
              <li key={date} className="flex items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`font-semibold ${date === today ? "text-primary" : ""}`}>
                    {t(`weekdays.${String(day) as "0"}`)}
                  </span>
                  <span className="text-sm text-text-muted">
                    {session
                      ? `${session.title ?? t(`focus.${session.focus}`)} · ${t("minutes", { count: session.minutes })}`
                      : t("home.restShort")}
                  </span>
                </span>
                {doneDates.has(date) && (
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                    {t("home.doneDay")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card aria-labelledby="training-streak">
        <h2 id="training-streak" className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-primary">
            <Icon name="dumbbell" />
          </span>
          {t("home.streak", { count: trainingStreak(weeks, weekStart) })}
        </h2>
      </Card>

      <p className="text-sm text-text-muted">{t("disclaimer")}</p>
    </>
  );
}
