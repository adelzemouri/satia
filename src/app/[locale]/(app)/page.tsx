import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME, APP_TIMEZONE } from "@/config/app";
import { MEAL_SLOTS } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { slotAt } from "@/domain/meals";
import { CalorieRing, MacroBars } from "@/features/journal/day-overview";
import { WaterTracker } from "@/features/journal/water-tracker";
import { WeekGauge } from "@/features/adaptive/week-gauge";
import { CheckinCard } from "@/features/quality/checkin-card";
import { QualityBars } from "@/features/quality/quality-bars";
import { PendingShares } from "@/features/family/pending-shares";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ensureWeeklyCheck, weekBudget } from "@/server/adaptive";
import { suggestedDish } from "@/server/coach";
import { pendingShares } from "@/server/family";
import { checkinOn, dayQualityFor } from "@/server/quality";
import { daySummary, streakFor } from "@/server/journal";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { Icon } from "@/ui/icon";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  const today = todayIso();
  // Bilan hebdomadaire de l'objectif adaptatif (une fois par semaine) avant d'afficher l'objectif.
  await ensureWeeklyCheck(user.id, today);
  const [summary, streak, shares, week, quality, checkin] = await Promise.all([
    daySummary(user.id, today),
    streakFor(user.id, today),
    pendingShares(user.id),
    profile.budgetMode === "weekly" ? weekBudget(user.id, today) : null,
    dayQualityFor(user.id, today),
    checkinOn(user.id, today),
  ]);
  const slot = slotAt(new Date(), APP_TIMEZONE);
  const dish = summary.goal ? await suggestedDish(user.id, summary.goal.kcal - summary.totals.kcal, today) : null;
  const t = await getTranslations();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("home.greeting", { name: profile.firstName })}</h1>

      {shares.length > 0 && (
        <Card aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-xl font-semibold">
            {t("family.pendingTitle")}
          </h2>
          <PendingShares shares={shares} />
        </Card>
      )}

      <Card aria-labelledby="today-title">
        <h2 id="today-title" className="font-semibold text-text-muted">
          {t("home.todayGoal")}
        </h2>
        <CalorieRing totals={summary.totals} goal={summary.goal} />
        <MacroBars totals={summary.totals} goal={summary.goal} />
        <QualityBars quality={quality} />
        {summary.zone && <p className="rounded-2xl bg-surface-muted px-4 py-3">{t(`home.zone.${summary.zone}`)}</p>}
        {week && (
          <>
            <WeekGauge consumed={week.consumed} total={week.total} />
            <Link href="/week" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t("week.open")}
            </Link>
          </>
        )}
      </Card>

      {dish && (
        <Card aria-labelledby="dish-title">
          <h2 id="dish-title" className="text-xl font-semibold">
            {t("coach.suggestionTitle", { slot })}
          </h2>
          <p>{t("coach.suggestionHint", { name: dish.name, kcal: dish.portionKcal })}</p>
          <Link
            href={{ pathname: "/add", query: { food: dish.id, slot, date: today } }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("coach.suggestionAdd", { name: dish.name })}
          </Link>
        </Card>
      )}

      <Card aria-labelledby="streak-title">
        <h2 id="streak-title" className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-primary">
            <Icon name="sprout" />
          </span>
          {t("home.streak", { days: streak.days })}
        </h2>
        {streak.frozenDays.length > 0 && <p className="text-text-muted">{t("home.streakFrozen")}</p>}
      </Card>

      <Card aria-labelledby="meals-title">
        <h2 id="meals-title" className="text-xl font-semibold">
          {t("home.meals")}
        </h2>
        <ul className="flex flex-col divide-y divide-border">
          {MEAL_SLOTS.map((slot) => (
            <li key={slot} className="flex items-center justify-between gap-3 py-2">
              <span className="flex flex-col">
                <span className="font-semibold">{t(`slots.${slot}`)}</span>
                <span className="text-sm text-text-muted">
                  {t("common.kcal", { value: Math.round(summary.bySlot[slot].totals.kcal) })}
                </span>
              </span>
              <Link
                href={{ pathname: "/add", query: { slot, date: today } }}
                aria-label={t("home.addTo", { slot: t(`slotsLower.${slot}`) })}
                className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"
              >
                <Icon name="plus" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/journal" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("home.openJournal")}
        </Link>
      </Card>

      <Card aria-labelledby="checkin-title">
        <h2 id="checkin-title" className="text-xl font-semibold">
          {t("checkin.title")}
        </h2>
        <p className="text-sm text-text-muted">{t("checkin.hint")}</p>
        <CheckinCard date={today} initial={checkin} />
      </Card>

      <Card aria-labelledby="water-title">
        <h2 id="water-title" className="text-xl font-semibold">
          {t("water.title")}
        </h2>
        <WaterTracker date={today} glasses={summary.water.glasses} goal={summary.water.goal} />
      </Card>

      <nav aria-label={t("home.more")} className="flex flex-col gap-3">
        {(
          [
            ["/coach", "chat", t("coach.title")],
            ["/family", "family", t("family.title")],
            ["/week", "calendar", t("week.title")],
            ["/metabolism", "pulse", t("metabolism.title")],
            ["/quality", "sprout", t("quality.title")],
          ] as const
        ).map(([href, icon, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-5 py-3 font-semibold shadow-sm hover:bg-surface-muted"
          >
            <span className="text-primary">
              <Icon name={icon} />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <p className="mt-auto text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
