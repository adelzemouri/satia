import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { MEAL_SLOTS } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { CalorieRing, MacroBars } from "@/features/journal/day-overview";
import { WaterTracker } from "@/features/journal/water-tracker";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
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
  const [summary, streak] = await Promise.all([daySummary(user.id, today), streakFor(user.id, today)]);
  const t = await getTranslations();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("home.greeting", { name: profile.firstName })}</h1>

      <Card aria-labelledby="today-title">
        <h2 id="today-title" className="font-semibold text-text-muted">
          {t("home.todayGoal")}
        </h2>
        <CalorieRing totals={summary.totals} goal={summary.goal} />
        <MacroBars totals={summary.totals} goal={summary.goal} />
        {summary.zone && <p className="rounded-2xl bg-surface-muted px-4 py-3">{t(`home.zone.${summary.zone}`)}</p>}
      </Card>

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

      <Card aria-labelledby="water-title">
        <h2 id="water-title" className="text-xl font-semibold">
          {t("water.title")}
        </h2>
        <WaterTracker date={today} glasses={summary.water.glasses} goal={summary.water.goal} />
      </Card>

      <p className="mt-auto text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
