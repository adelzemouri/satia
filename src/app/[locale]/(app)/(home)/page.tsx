import { getTranslations, setRequestLocale } from "next-intl/server";
import { after } from "next/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { dailyMessage, STREAK_MILESTONES } from "@/domain/daily-message";
import { slotAt } from "@/domain/meals";
import { suggestedQuestions } from "@/domain/coach-questions";
import { ideasForSlot } from "@/domain/recipes/catalog";
import { CalorieSummary, MacroBars } from "@/features/journal/day-overview";
import { WaterTile } from "@/features/journal/water-tile";
import { BalanceCard } from "@/features/home/balance-card";
import { CoachCard } from "@/features/home/coach-card";
import { ActivityTiles, FastingTile, TreatmentTile } from "@/features/home/day-cards";
import { MealRings } from "@/features/home/meal-rings";
import { WeekStrip } from "@/features/home/week-strip";
import { WeekGauge } from "@/features/adaptive/week-gauge";
import { PendingShares } from "@/features/family/pending-shares";
import { RecipeCard } from "@/features/recipes/recipe-card";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck, weekBudget } from "@/server/adaptive";
import { pendingShares } from "@/server/family";
import { purgePhotosIfDue } from "@/server/photos";
import { currentFast, fastingAllowed, getFastingPlan } from "@/server/fasting";
import { daySummary, streakFor, weekIntake } from "@/server/journal";
import { dayQualityFor } from "@/server/quality";
import { treatmentRemindersOn } from "@/server/treatment";
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
  const now = new Date();
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [summary, streak, shares, week, fast, fastingPlan, canFast, catalog, days, quality, reminders] =
    await Promise.all([
      daySummary(user.id, today),
      streakFor(user.id, today),
      pendingShares(user.id),
      profile.budgetMode === "weekly" ? weekBudget(user.id, today) : null,
      currentFast(user.id, now),
      getFastingPlan(user.id),
      fastingAllowed(user.id),
      catalogEntries(),
      weekIntake(user.id, today),
      dayQualityFor(user.id, today),
      treatmentRemindersOn(user.id, today, weekday),
    ]);
  // Le repas du moment est mis en avant : c'est le plus probable à saisir maintenant.
  const current = slotAt(now, APP_TIMEZONE);
  const ideas = ideasForSlot(catalog, current, `${user.id}:${today}`, 4);
  const t = await getTranslations();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(now),
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
  const burnedKcal = summary.training.burnedKcal + summary.activity.burnedKcal;
  const kcalBySlot = {
    breakfast: summary.bySlot.breakfast.totals.kcal,
    lunch: summary.bySlot.lunch.totals.kcal,
    dinner: summary.bySlot.dinner.totals.kcal,
    snack: summary.bySlot.snack.totals.kcal,
  };
  const showFasting = canFast && (fast !== null || fastingPlan.enabled);
  const questions = suggestedQuestions(hour, `${user.id}:${today}`);
  const milestone = summary.entries.length > 0 && (STREAK_MILESTONES as readonly number[]).includes(streak.days);

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/journal"
            className="flex min-h-12 items-center gap-2 rounded-full bg-surface px-4 font-semibold first-letter:uppercase"
          >
            <span className="text-primary">
              <Icon name="calendar" size={20} />
            </span>
            <span className="first-letter:uppercase">{formatDay(today, locale)}</span>
          </Link>
          <Link
            href="/profile"
            aria-label={t("home.openProfile")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-extrabold text-primary"
          >
            {profile.firstName.slice(0, 1).toUpperCase()}
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {t("home.greeting", { name: profile.firstName })}
          </h1>
          <p className="text-text-muted">
            {message.key === "tip"
              ? t(`home.daily.tips.${String(message.index) as "0"}`)
              : t(`home.daily.${message.key}`, message)}
          </p>
        </div>
        <WeekStrip days={days} today={today} goalKcal={summary.goal?.kcal ?? null} locale={locale} />
      </header>

      {shares.length > 0 && (
        <Card aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-xl font-bold">
            {t("family.pendingTitle")}
          </h2>
          <PendingShares shares={shares} />
        </Card>
      )}

      <Card aria-labelledby="today-title">
        <h2 id="today-title" className="sr-only">
          {t("home.todayGoal")}
        </h2>
        <CalorieSummary totals={summary.totals} goal={summary.goal} burnedKcal={burnedKcal} />
        <MacroBars totals={summary.totals} goal={summary.goal} />
        {week && (
          <Link href="/week" className="flex flex-col gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <WeekGauge consumed={week.consumed} total={week.total} />
            <span className="font-semibold text-primary">{t("week.open")}</span>
          </Link>
        )}
      </Card>

      <Card aria-labelledby="meals-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="meals-title" className="text-lg font-bold">
            {t("home.meals")}
          </h2>
          <Link
            href="/journal"
            className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("home.openJournal")}
          </Link>
        </div>
        <MealRings kcalBySlot={kcalBySlot} goalKcal={summary.goal?.kcal ?? null} current={current} date={today} />
      </Card>

      <WaterTile date={today} {...summary.water} />

      {summary.entries.length > 0 && <BalanceCard quality={quality} />}

      <ActivityTiles steps={summary.activity.steps} burnedKcal={burnedKcal} />

      {(showFasting || reminders.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {showFasting && <FastingTile fast={fast} now={now} />}
          {reminders.length > 0 && <TreatmentTile reminders={reminders} />}
        </div>
      )}

      <CoachCard questions={questions} />

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
          <ul data-swipe-lock className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
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

      <section
        aria-labelledby="streak-title"
        className={`flex items-center gap-3 rounded-[var(--radius-card)] p-4 ${milestone ? "celebrate bg-primary-soft" : "bg-surface"}`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="sprout" />
        </span>
        <div className="flex flex-col">
          <h2 id="streak-title" className="font-bold">
            {t("home.streak", { days: streak.days })}
          </h2>
          {streak.frozenDays.length > 0 && <p className="text-sm text-text-muted">{t("home.streakFrozen")}</p>}
        </div>
      </section>
    </>
  );
}
