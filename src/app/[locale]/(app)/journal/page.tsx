import { getTranslations, setRequestLocale } from "next-intl/server";

import { MEAL_SLOTS } from "@/domain/meals";
import { parseDayParam } from "@/domain/day-param";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import { availableUnits, type Unit } from "@/domain/units";
import { CopyButton } from "@/features/journal/copy-button";
import { CalorieSummary, MacroBars, MacroLine, MacroSplit } from "@/features/journal/day-overview";
import { EntryRow } from "@/features/journal/entry-row";
import { groupByDish } from "@/domain/dishes";
import { WaterTracker } from "@/features/journal/water-tracker";
import { QualityBars } from "@/features/quality/quality-bars";
import { SaveMealButton } from "@/features/saved-meals/save-meal-button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { getFoods } from "@/server/foods";
import { daySummary, entriesOn, loggedDays } from "@/server/journal";
import { photoUrls } from "@/server/photos";
import { dayQualityFor } from "@/server/quality";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { formatDay, formatWeekday } from "@/ui/format-date";
import { Icon } from "@/ui/icon";
import { ScrollToHash } from "@/ui/scroll-to-hash";
import { Columns } from "@/ui/columns";

export default async function JournalPage({ params, searchParams }: PageProps<"/[locale]/journal">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const date = parseDayParam((await searchParams).date, today);
  const yesterday = addDays(today, -1);
  const weekStart = isoWeekStart(date);
  const week = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const [summary, yesterdayEntries, quality, logged] = await Promise.all([
    daySummary(user.id, date),
    date === today ? entriesOn(user.id, yesterday) : Promise.resolve([]),
    dayQualityFor(user.id, date),
    loggedDays(user.id, week[0]!, week[6]!),
  ]);
  const foods = new Map(
    (
      await getFoods(
        user.id,
        summary.entries.flatMap((entry) => (entry.foodId ? [entry.foodId] : [])),
      )
    ).map((food) => [food.id, food]),
  );
  // Photos des repas saisis par photo (URL signées courtes) ; le journal s'affiche même si le stockage ne répond pas.
  const photos = await photoUrls(
    user.id,
    summary.entries.flatMap((entry) => (entry.photoId ? [entry.photoId] : [])),
  ).catch(() => new Map<string, string>());
  const t = await getTranslations();

  const unitsFor = (foodId: string | null, current: Unit): Unit[] => {
    const food = foodId ? foods.get(foodId) : undefined;
    return food ? availableUnits(food) : [current];
  };
  const dayTitle =
    date === today ? t("journal.today") : date === yesterday ? t("journal.yesterday") : formatDay(date, locale);

  return (
    <Columns>
      <ScrollToHash />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("journal.title")}</h1>

      <ol aria-label={t("journal.week")} className="grid grid-cols-7 gap-1.5">
        {week.map((day) => {
          const selected = day === date;
          const content = (
            <>
              <span className="text-xs font-semibold">{formatWeekday(day, locale)}</span>
              <span className="font-bold">{Number(day.slice(8))}</span>
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  logged.has(day) ? (selected ? "bg-primary-soft" : "bg-primary") : "bg-transparent"
                }`}
              />
            </>
          );
          const base = "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl";
          return (
            <li key={day}>
              {day > today ? (
                <span className={`${base} text-text-muted`}>{content}</span>
              ) : (
                <Link
                  href={{ pathname: "/journal", query: { date: day } }}
                  aria-current={selected ? "date" : undefined}
                  aria-label={`${formatDay(day, locale)}${logged.has(day) ? `, ${t("journal.hasEntries")}` : ""}`}
                  className={`${base} ${selected ? "bg-text text-bg" : "bg-surface hover:bg-surface-muted"}`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {/* Changer de semaine : des liens en toutes lettres, pour ne pas confondre avec le bouton Retour. */}
      <nav
        aria-label={t("journal.days")}
        className="-mt-2 flex items-center justify-between gap-3 text-sm font-semibold"
      >
        <Link
          href={{ pathname: "/journal", query: { date: addDays(date, -7) } }}
          className="flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
        >
          {t("journal.previousWeek")}
        </Link>
        {date !== today && (
          <Link
            href={{ pathname: "/journal", query: { date: addDays(date, 7) < today ? addDays(date, 7) : today } }}
            className="flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
          >
            {addDays(date, 7) < today ? t("journal.nextWeek") : t("journal.backToToday")}
          </Link>
        )}
      </nav>

      {/* Le bilan du jour se distingue des repas : fond vert pâle, étiquette et titre en Fraunces. */}
      <Card aria-labelledby="day-total" tone="highlight">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">{t("journal.dayBalance")}</p>
            <h2
              id="day-total"
              className="font-display text-2xl font-extrabold tracking-tight first-letter:uppercase"
              aria-live="polite"
            >
              {dayTitle}
            </h2>
          </div>
          {date === today && yesterdayEntries.length > 0 && summary.entries.length === 0 && (
            <CopyButton
              fromDate={yesterday}
              fromSlot={null}
              toDate={today}
              label={t("journal.duplicateYesterday")}
              compact
            />
          )}
        </div>
        <CalorieSummary totals={summary.totals} goal={summary.goal} compact />
        <MacroBars totals={summary.totals} goal={summary.goal} />
        {summary.entries.length > 0 && <MacroSplit bySlot={summary.bySlot} totals={summary.totals} />}
        <QualityBars quality={quality} />
        {summary.zone && <p className="text-sm text-text-muted">{t(`home.zone.${summary.zone}`)}</p>}
        {summary.entries.length === 0 && (
          <EmptyState
            scene="plate"
            action={
              <Link href={{ pathname: "/add", query: { date } }} className={buttonClass()}>
                {t("journal.firstMeal")}
              </Link>
            }
          >
            {t("journal.emptyDay")}
          </EmptyState>
        )}
      </Card>

      {MEAL_SLOTS.map((slot) => {
        const { entries, totals } = summary.bySlot[slot];
        const slotPhotos = [...new Set(entries.flatMap((entry) => (entry.photoId ? [entry.photoId] : [])))].flatMap(
          (id) => photos.get(id) ?? [],
        );
        return (
          <Card key={slot} aria-labelledby={`slot-${slot}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`slot-${slot}`} className="scroll-mt-24 text-lg font-bold">
                {t(`slots.${slot}`)}
              </h2>
              <span className="font-semibold text-text-muted">
                {t("common.kcal", { value: Math.round(totals.kcal) })}
              </span>
            </div>
            {entries.length > 0 && <MacroLine totals={totals} />}
            {slotPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {slotPhotos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage privé, valable 5 min
                  <img
                    key={url}
                    src={url}
                    alt={t("journal.mealPhoto", { slot: t(`slotsLower.${slot}`) })}
                    className="size-24 rounded-2xl object-cover"
                  />
                ))}
              </div>
            )}
            {entries.length === 0 ? (
              <p className="text-text-muted">{t("journal.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {groupByDish(entries).flatMap((group) => [
                  group.dish && (
                    <li key={`dish-${group.items[0]!.id}`} className="pt-3 pb-1 text-sm font-semibold text-text-muted">
                      {group.dish}
                    </li>
                  ),
                  ...group.items.map((entry) => (
                    <li key={entry.id}>
                      <EntryRow
                        entry={{
                          id: entry.id,
                          label: entry.label,
                          quantity: entry.quantity,
                          unit: entry.unit,
                          grams: entry.grams,
                          kcal: entry.kcal,
                          proteinG: entry.proteinG,
                          carbsG: entry.carbsG,
                          fatG: entry.fatG,
                          slot: entry.slot,
                          isEstimated: entry.isEstimated,
                          imageUrl: (entry.foodId && foods.get(entry.foodId)?.imageUrl) || null,
                        }}
                        units={unitsFor(entry.foodId, entry.unit)}
                      />
                    </li>
                  )),
                ])}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                href={{ pathname: "/add", query: { slot, date } }}
                className={buttonClass("secondary")}
                aria-label={t("home.addTo", { slot, name: t(`slotsLower.${slot}`) })}
              >
                <Icon name="plus" />
                {t("journal.add")}
              </Link>
              {date !== today && entries.length > 0 && (
                <CopyButton fromDate={date} fromSlot={slot} toDate={today} label={t("journal.copyToToday")} />
              )}
              {entries.length > 0 && (
                <SaveMealButton date={date} slot={slot} labels={entries.map((entry) => entry.label)} />
              )}
            </div>
          </Card>
        );
      })}

      <Card aria-labelledby="water-title">
        <h2 id="water-title" className="text-lg font-bold">
          {t("water.title")}
        </h2>
        <WaterTracker date={date} {...summary.water} />
      </Card>
    </Columns>
  );
}
