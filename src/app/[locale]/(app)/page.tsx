import { getTranslations, setRequestLocale } from "next-intl/server";
import { after } from "next/server";

import { APP_TIMEZONE } from "@/config/app";
import { MEAL_SLOTS } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { dailyMessage, STREAK_MILESTONES } from "@/domain/daily-message";
import { slotAt } from "@/domain/meals";
import { ideasForSlot } from "@/domain/recipes/catalog";
import { CalorieSummary, MacroBars } from "@/features/journal/day-overview";
import { WaterTile } from "@/features/journal/water-tile";
import { WeekGauge } from "@/features/adaptive/week-gauge";
import { PendingShares } from "@/features/family/pending-shares";
import { RecipeCard } from "@/features/recipes/recipe-card";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck, weekBudget } from "@/server/adaptive";
import { pendingShares } from "@/server/family";
import { purgePhotosIfDue } from "@/server/photos";
import { currentFast } from "@/server/fasting";
import { daySummary, streakFor } from "@/server/journal";
import { getProfile } from "@/server/profile";
import { catalogEntries } from "@/server/recipes";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { Icon } from "@/ui/icon";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  const today = todayIso();
  // Purge des photos sans attendre le cron (s'il n'est pas configuré), après l'envoi de la page.
  after(() => purgePhotosIfDue().catch((error: unknown) => console.error("Purge des photos échouée", error)));
  // Bilan hebdomadaire de l'objectif adaptatif (une fois par semaine) avant d'afficher l'objectif.
  await ensureWeeklyCheck(user.id, today);
  const [summary, streak, shares, week, fast, catalog] = await Promise.all([
    daySummary(user.id, today),
    streakFor(user.id, today),
    pendingShares(user.id),
    profile.budgetMode === "weekly" ? weekBudget(user.id, today) : null,
    currentFast(user.id),
    catalogEntries(),
  ]);
  // Le repas du moment est mis en avant : c'est le plus probable à saisir maintenant.
  const current = slotAt(new Date(), APP_TIMEZONE);
  const ideas = ideasForSlot(catalog, current, `${user.id}:${today}`, 4);
  const t = await getTranslations();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()),
  );
  const message = dailyMessage({
    hour,
    mainMealsLogged: (["breakfast", "lunch", "dinner"] as const).filter(
      (slot) => summary.bySlot[slot].entries.length > 0,
    ).length,
    loggedToday: summary.entries.length > 0,
    remainingKcal: summary.goal ? summary.goal.kcal - summary.totals.kcal : null,
    waterGlasses: summary.water.glasses,
    waterGoal: summary.water.goal,
    streakDays: streak.days,
    seed: `${user.id}:${today}`,
  });
  const milestone = summary.entries.length > 0 && (STREAK_MILESTONES as readonly number[]).includes(streak.days);

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="font-semibold text-text-muted first-letter:uppercase">{formatDay(today, locale)}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {t("home.greeting", { name: profile.firstName })}
          </h1>
        </div>
        <Link
          href="/profile"
          aria-label={t("home.openProfile")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-extrabold text-primary"
        >
          {profile.firstName.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      <p className="-mt-3 text-text-muted">
        {message.key === "tip"
          ? t(`home.daily.tips.${String(message.index) as "0"}`)
          : t(`home.daily.${message.key}`, message)}
      </p>

      {shares.length > 0 && (
        <Card aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-xl font-bold">
            {t("family.pendingTitle")}
          </h2>
          <PendingShares shares={shares} />
        </Card>
      )}

      {fast && (
        <Link
          href="/fasting"
          className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] bg-primary-soft px-5 py-3"
        >
          <span className="text-primary">
            <Icon name="timer" />
          </span>
          <span className="flex flex-col">
            <span className="font-bold">{t("home.fastRunning")}</span>
            <span className="text-sm">
              {t("home.fastUntil", {
                end: new Date(new Date(fast.startedAt).getTime() + fast.targetMinutes * 60_000),
              })}
            </span>
          </span>
          <span className="sr-only">{t("home.fastOpen")}</span>
        </Link>
      )}

      <Card aria-labelledby="today-title">
        <h2 id="today-title" className="sr-only">
          {t("home.todayGoal")}
        </h2>
        <CalorieSummary totals={summary.totals} goal={summary.goal} />
        {summary.training.burnedKcal + summary.activity.burnedKcal > 0 && (
          <p className="text-sm text-text-muted">
            {t("home.activityBurned", { kcal: summary.training.burnedKcal + summary.activity.burnedKcal })}
          </p>
        )}
        <MacroBars totals={summary.totals} goal={summary.goal} />
        {week && (
          <Link href="/week" className="flex flex-col gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <WeekGauge consumed={week.consumed} total={week.total} />
            <span className="font-semibold text-primary">{t("week.open")}</span>
          </Link>
        )}
      </Card>

      <Card aria-labelledby="meals-title">
        <h2 id="meals-title" className="text-xl font-bold">
          {t("home.meals")}
        </h2>
        <ul className="-my-1 flex flex-col divide-y divide-border">
          {MEAL_SLOTS.map((slot) => {
            const { totals, entries } = summary.bySlot[slot];
            const highlight = slot === current && entries.length === 0;
            return (
              <li key={slot} className="flex min-h-16 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{t(`slots.${slot}`)}</span>
                  <span className="truncate text-sm text-text-muted">
                    {entries.length > 0
                      ? t("home.slotSummary", {
                          kcal: Math.round(totals.kcal),
                          labels: entries.map((entry) => entry.label).join(", "),
                        })
                      : t("home.slotEmpty")}
                  </span>
                </span>
                <Link
                  href={{ pathname: "/add", query: { slot, date: today } }}
                  aria-label={t("home.addTo", { slot: t(`slotsLower.${slot}`) })}
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                    highlight ? "bg-primary text-on-primary" : "bg-primary-soft text-primary"
                  }`}
                >
                  <Icon name="plus" />
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/journal" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("home.openJournal")}
        </Link>
      </Card>

      {ideas.length > 0 && (
        <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="ideas-title" className="text-xl font-bold">
              {t("recipes.homeTitle", { slot: current })}
            </h2>
            <Link href="/recipes" className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline">
              {t("recipes.homeMore")}
            </Link>
          </div>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {ideas.map((entry) => (
              <li key={entry.id} className="flex w-[44%] shrink-0 snap-start sm:w-[30%]">
                <RecipeCard
                  id={entry.id}
                  recipe={entry.recipe}
                  portionKcal={entry.portionKcal}
                  query={{ slot: current, date: today }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <WaterTile date={today} glasses={summary.water.glasses} goal={summary.water.goal} />
        <section
          aria-labelledby="streak-title"
          className={`flex flex-col gap-2 rounded-[var(--radius-card)] p-4 ${milestone ? "celebrate bg-primary-soft" : "bg-surface"}`}
        >
          <span className="text-primary">
            <Icon name="sprout" />
          </span>
          <h2 id="streak-title" className="font-bold">
            {t("home.streak", { days: streak.days })}
          </h2>
          {streak.frozenDays.length > 0 && <p className="text-sm text-text-muted">{t("home.streakFrozen")}</p>}
        </section>
      </div>
    </>
  );
}
