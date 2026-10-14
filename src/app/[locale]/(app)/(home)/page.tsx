import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { after } from "next/server";

import { APP_TIMEZONE, COACH_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { dailyMessage, STREAK_MILESTONES } from "@/domain/daily-message";
import { slotAt } from "@/domain/meals";
import { withDefaultPrefs } from "@/domain/notifications";
import { dueRituals, freshVictory, nextWeighDay, parseSnoozes, SNOOZE_COOKIE, weighStatus } from "@/domain/rituals";
import { suggestedQuestions } from "@/domain/coach-questions";
import { ideasForSlot } from "@/domain/recipes/catalog";
import { CalorieSummary, MacroBars } from "@/features/journal/day-overview";
import { WaterTile } from "@/features/journal/water-tile";
import { BalanceCard } from "@/features/home/balance-card";
import { CoachCard } from "@/features/home/coach-card";
import { CoachAvatar } from "@/features/coach/coach-avatar";
import { StreakCelebration } from "@/features/home/streak-celebration";
import { ActivityTiles, FastingTile, TreatmentTile } from "@/features/home/day-cards";
import { MealRings } from "@/features/home/meal-rings";
import { RitualCards, VictoryAnnouncement } from "@/features/home/rituals";
import { WeekStrip } from "@/features/home/week-strip";
import { PendingShares } from "@/features/family/pending-shares";
import { RecipeCard } from "@/features/recipes/recipe-card";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck } from "@/server/adaptive";
import { pendingShares } from "@/server/family";
import { purgePhotosIfDue } from "@/server/photos";
import { currentFast, fastingAllowed, getFastingPlan } from "@/server/fasting";
import { daySummary, latestWeight, streakFor, recentIntake } from "@/server/journal";
import { dayQualityFor } from "@/server/quality";
import { treatmentRemindersOn } from "@/server/treatment";
import { getProfile } from "@/server/profile";
import { catalogEntries } from "@/server/recipes";
import { ritualDates } from "@/server/rituals";
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
  const [summary, streak, shares, fast, fastingPlan, canFast, catalog, days, quality, reminders, dates, lastWeight] =
    await Promise.all([
      daySummary(user.id, today),
      streakFor(user.id, today),
      pendingShares(user.id),
      currentFast(user.id, now),
      getFastingPlan(user.id),
      fastingAllowed(user.id),
      catalogEntries(),
      recentIntake(user.id, today),
      dayQualityFor(user.id, today),
      treatmentRemindersOn(user.id, today, weekday),
      ritualDates(user.id, today),
      latestWeight(user.id, today),
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
  // Rendez-vous de Pépin : pesée de la semaine, mensurations et photo du mois.
  const prefs = withDefaultPrefs(profile.notificationPrefs);
  const rituals = dueRituals({
    today,
    prefs,
    ...dates,
    snoozedUntil: parseSnoozes((await cookies()).get(SNOOZE_COOKIE)?.value),
  });
  const weigh = weighStatus(dates.weighDates, today, prefs.weighDay);
  const weighedToday = prefs.weighIn && dates.weighDates.includes(today);
  const nextWeigh = nextWeighDay(today, prefs.weighDay);
  const victory = freshVictory({ today, weighDay: prefs.weighDay, ...dates });
  const milestone = summary.entries.length > 0 && (STREAK_MILESTONES as readonly number[]).includes(streak.days);

  return (
    // Téléphone : une seule colonne (les deux groupes s'effacent avec « contents »). Ordinateur :
    // la journée à gauche, eau, activité et Pépin à droite, l'en-tête sur toute la largeur.
    <div data-wide className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.45fr_1fr] lg:items-start">
      <header className="flex flex-col gap-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/journal"
            className="flex min-h-12 min-w-0 items-center gap-2 rounded-full bg-surface px-4 font-semibold"
          >
            <span className="shrink-0 text-primary">
              <Icon name="calendar" size={20} />
            </span>
            {/* Une seule ligne : date abrégée (« dim. 11 oct. ») sur les téléphones étroits. */}
            <span className="truncate first-letter:uppercase min-[430px]:hidden">
              {formatDay(today, locale, "compact")}
            </span>
            <span className="hidden truncate first-letter:uppercase min-[430px]:block">{formatDay(today, locale)}</span>
          </Link>
          <Link
            href="/progress"
            aria-label={t("home.streak", { days: streak.days })}
            className={`ml-auto flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-bold whitespace-nowrap ${milestone ? "celebrate bg-pomme text-on-pomme" : "bg-pomme-soft text-text"}`}
          >
            <Icon name="sprout" size={20} />
            {t("home.streakShort", { days: streak.days })}
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
          {/* Pépin dit bonjour et signe le message du jour : le bonjour ne prend plus une ligne à
              part, pour que l'anneau du jour tienne dans le premier écran du téléphone. */}
          <div className="flex items-end gap-2">
            <CoachAvatar size={40} />
            <div
              className={`min-w-0 rounded-2xl rounded-bl-md px-3.5 py-2.5 ${message.key === "streak" ? "bg-pomme-soft" : "bg-surface"}`}
            >
              <h1 className="font-display text-xl leading-tight font-extrabold tracking-tight">
                {t("home.greeting", { name: profile.firstName })}
              </h1>
              <p className={`text-sm ${message.key === "streak" ? "font-semibold" : ""}`}>
                <span className="sr-only">{t("home.pepinSays", { name: COACH_NAME })} </span>
                {message.key === "tip"
                  ? t(`home.daily.tips.${String(message.index) as "0"}`)
                  : t(`home.daily.${message.key}`, message)}
              </p>
            </div>
          </div>
          {streak.frozenDays.length > 0 && <p className="text-sm text-text-muted">{t("home.streakFrozen")}</p>}
        </div>
        <WeekStrip days={days} today={today} goalKcal={summary.goal?.kcal ?? null} locale={locale} />
      </header>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        {shares.length > 0 && (
          <Card aria-labelledby="pending-title">
            <h2 id="pending-title" className="text-xl font-bold">
              {t("family.pendingTitle")}
            </h2>
            <PendingShares shares={shares} />
          </Card>
        )}

        {/* Le premier écran : l'anneau, les macros et les repas du jour, avec un seul geste à faire. */}
        <Card aria-labelledby="today-title">
          <h2 id="today-title" className="sr-only">
            {t("home.todayGoal")}
          </h2>
          <CalorieSummary totals={summary.totals} goal={summary.goal} burnedKcal={burnedKcal} />
          <MacroBars totals={summary.totals} goal={summary.goal} />
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
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

        {/* Les rendez-vous (pesée, mensurations) viennent sous l'anneau : ils ne servent qu'une fois par semaine. */}
        <RitualCards
          rituals={rituals}
          done={weighedToday ? { weeks: weigh.weeks, nextWeigh } : null}
          today={today}
          lastWeight={lastWeight}
          nextWeigh={nextWeigh}
        />

        {ideas.length > 0 && (
          <section aria-labelledby="ideas-title" className="order-last flex flex-col gap-3 lg:order-none">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="ideas-title" className="text-xl font-bold">
                {t("recipes.homeTitle", { slot: current })}
              </h2>
              <Link href="/recipes" className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline">
                {t("recipes.homeMore")}
              </Link>
            </div>
            <ul
              data-swipe-lock
              className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
            >
              {ideas.map((entry) => (
                <li key={entry.id} className="flex w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
                  <RecipeCard
                    id={entry.id}
                    recipe={entry.recipe}
                    portionKcal={entry.portionKcal}
                    imageUrl={entry.imageUrl}
                    query={{ slot: current, date: today }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <WaterTile date={today} {...summary.water} />

        <div className="grid grid-cols-2 gap-3">
          <ActivityTiles steps={summary.activity.steps} burnedKcal={burnedKcal} />
          {showFasting && <FastingTile fast={fast} now={now} />}
          {reminders.length > 0 && <TreatmentTile reminders={reminders} />}
        </div>

        {summary.entries.length > 0 && <BalanceCard quality={quality} />}

        <CoachCard questions={questions} />
      </div>

      {milestone && <StreakCelebration days={streak.days} date={today} />}
      {!milestone && victory && <VictoryAnnouncement victory={victory} />}
    </div>
  );
}
