import { getTranslations, setRequestLocale } from "next-intl/server";

import { addDays } from "@/domain/energy";
import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { exerciseById } from "@/domain/training/exercises";
import { personalRecords, trainingStreak, volumeByMuscle } from "@/domain/training/program";
import { MUSCLES } from "@/domain/training/types";
import { DeleteSessionButton } from "@/features/training/delete-session-button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { trainingHistory, trainingWeeks } from "@/server/training";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { formatDay } from "@/ui/format-date";

export default async function TrainingHistoryPage({ params }: PageProps<"/[locale]/training/history">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const [sessions, weeks] = await Promise.all([trainingHistory(user.id, 365), trainingWeeks(user.id)]);
  const t = await getTranslations("training");

  // Calendrier : 8 semaines, du lundi au dimanche.
  const firstMonday = addDays(isoWeekStart(today), -49);
  const counts = new Map<string, number>();
  for (const session of sessions) counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
  const calendar = Array.from({ length: 8 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(firstMonday, week * 7 + day)),
  );
  const recent = sessions.filter((session) => session.date >= addDays(today, -27));
  const volume = volumeByMuscle(recent);
  const maxVolume = Math.max(1, ...Object.values(volume));
  const records = personalRecords(sessions).filter((record) => exerciseById(record.exerciseId)?.phase === "main");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("history.title")}</h1>
      <p className="text-lg font-semibold">{t("home.streak", { count: trainingStreak(weeks, isoWeekStart(today)) })}</p>

      <Card aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="text-xl font-semibold">
          {t("history.calendar")}
        </h2>
        <div className="grid grid-cols-7 gap-1.5" role="list">
          {calendar.flat().map((date) => {
            const count = counts.get(date) ?? 0;
            const label = t("history.calendarDay", { date: formatDay(date, locale, "short"), count });
            return (
              <span
                key={date}
                role="listitem"
                aria-label={label}
                title={label}
                className={`aspect-square rounded-lg border ${
                  date > today
                    ? "border-dashed border-border"
                    : count > 0
                      ? "border-primary bg-primary"
                      : "border-border bg-surface-muted"
                }`}
              />
            );
          })}
        </div>
      </Card>

      <Card aria-labelledby="volume-title">
        <h2 id="volume-title" className="text-xl font-semibold">
          {t("history.volume")}
        </h2>
        {Object.keys(volume).length === 0 ? (
          <p className="text-text-muted">{t("history.none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {MUSCLES.filter((muscle) => volume[muscle]).map((muscle) => (
              <li key={muscle} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm">
                  <span className="font-semibold">{t(`muscles.${muscle}`)}</span>
                  <span>{t("history.volumeValue", { count: volume[muscle]! })}</span>
                </span>
                <span className="h-2 rounded-full bg-surface-muted" aria-hidden>
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${Math.round((volume[muscle]! / maxVolume) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="records-title">
        <h2 id="records-title" className="text-xl font-semibold">
          {t("history.records")}
        </h2>
        {records.length === 0 ? (
          <p className="text-text-muted">{t("history.noRecords")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {records.map((record) => (
              <li key={record.exerciseId} className="flex justify-between gap-3 py-2">
                <span>{exerciseById(record.exerciseId)?.name}</span>
                <span className="text-right font-semibold">
                  {[
                    record.maxWeightKg !== null && t("history.recordKg", { value: record.maxWeightKg }),
                    record.maxReps !== null && t("history.recordReps", { count: record.maxReps }),
                    record.maxSeconds !== null && t("history.recordSeconds", { count: record.maxSeconds }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="sessions-title">
        <h2 id="sessions-title" className="text-xl font-semibold">
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
                    <span className="text-sm text-text-muted">
                      {t("history.summary", { minutes: session.durationMin, kcal: session.kcal })}
                      {session.feeling && ` · ${t(`session.feelings.${session.feeling}`)}`}
                    </span>
                  </span>
                  <DeleteSessionButton id={session.id} label={date} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
