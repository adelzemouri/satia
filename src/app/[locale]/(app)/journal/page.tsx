import { getTranslations, setRequestLocale } from "next-intl/server";

import { MEAL_SLOTS } from "@/domain/meals";
import { parseDayParam } from "@/domain/day-param";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { availableUnits, type Unit } from "@/domain/units";
import { CopyButton } from "@/features/journal/copy-button";
import { CalorieRing, MacroBars } from "@/features/journal/day-overview";
import { EntryRow } from "@/features/journal/entry-row";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getFoods } from "@/server/foods";
import { daySummary, entriesOn } from "@/server/journal";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { Icon } from "@/ui/icon";

export default async function JournalPage({ params, searchParams }: PageProps<"/[locale]/journal">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const date = parseDayParam((await searchParams).date, today);
  const yesterday = addDays(today, -1);
  const [summary, yesterdayEntries] = await Promise.all([
    daySummary(user.id, date),
    date === today ? entriesOn(user.id, yesterday) : Promise.resolve([]),
  ]);
  const foods = new Map(
    (
      await getFoods(
        user.id,
        summary.entries.flatMap((entry) => (entry.foodId ? [entry.foodId] : [])),
      )
    ).map((food) => [food.id, food]),
  );
  const t = await getTranslations();

  const unitsFor = (foodId: string | null, current: Unit): Unit[] => {
    const food = foodId ? foods.get(foodId) : undefined;
    return food ? availableUnits(food) : [current];
  };
  const dayTitle =
    date === today ? t("journal.today") : date === yesterday ? t("journal.yesterday") : formatDay(date, locale);

  return (
    <>
      <h1 className="sr-only">{t("journal.title")}</h1>
      <nav className="flex items-center justify-between gap-2" aria-label={t("journal.title")}>
        <Link
          href={{ pathname: "/journal", query: { date: addDays(date, -1) } }}
          aria-label={t("journal.previousDay")}
          className="flex size-12 items-center justify-center rounded-full hover:bg-surface-muted"
        >
          <Icon name="left" />
        </Link>
        <p className="font-display text-2xl font-semibold first-letter:uppercase" aria-live="polite">
          {dayTitle}
        </p>
        {date < today ? (
          <Link
            href={{ pathname: "/journal", query: { date: addDays(date, 1) } }}
            aria-label={t("journal.nextDay")}
            className="flex size-12 items-center justify-center rounded-full hover:bg-surface-muted"
          >
            <Icon name="right" />
          </Link>
        ) : (
          <span className="size-12" aria-hidden />
        )}
      </nav>

      <Card aria-labelledby="day-total">
        <h2 id="day-total" className="font-semibold text-text-muted">
          {t("journal.dayTotal")}
        </h2>
        <CalorieRing totals={summary.totals} goal={summary.goal} />
        <MacroBars totals={summary.totals} goal={summary.goal} />
      </Card>

      {date === today && yesterdayEntries.length > 0 && summary.entries.length === 0 && (
        <CopyButton fromDate={yesterday} fromSlot={null} toDate={today} label={t("journal.duplicateYesterday")} />
      )}

      {MEAL_SLOTS.map((slot) => {
        const { entries, totals } = summary.bySlot[slot];
        return (
          <Card key={slot} aria-labelledby={`slot-${slot}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`slot-${slot}`} className="text-xl font-semibold">
                {t(`slots.${slot}`)}
              </h2>
              <span className="font-semibold text-text-muted">
                {t("common.kcal", { value: Math.round(totals.kcal) })}
              </span>
            </div>
            {entries.length === 0 ? (
              <p className="text-text-muted">{t("journal.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <EntryRow
                      entry={{
                        id: entry.id,
                        label: entry.label,
                        quantity: entry.quantity,
                        unit: entry.unit,
                        grams: entry.grams,
                        kcal: entry.kcal,
                        slot: entry.slot,
                        isEstimated: entry.isEstimated,
                      }}
                      units={unitsFor(entry.foodId, entry.unit)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                href={{ pathname: "/add", query: { slot, date } }}
                className={buttonClass("secondary")}
                aria-label={t("home.addTo", { slot: t(`slotsLower.${slot}`) })}
              >
                <Icon name="plus" />
                {t("journal.add")}
              </Link>
              {date !== today && entries.length > 0 && (
                <CopyButton fromDate={date} fromSlot={slot} toDate={today} label={t("journal.copyToToday")} />
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
