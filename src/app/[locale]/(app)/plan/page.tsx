import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { MEAL_SLOTS } from "@/domain/meals";
import { catalogRecipeFor } from "@/domain/recipes/catalog";
import { isoWeekStart } from "@/domain/streak";
import { weekDates } from "@/domain/weekly-budget";
import { AddPlanItemForm } from "@/features/planning/add-plan-item-form";
import { AutoRefresh } from "@/features/planning/auto-refresh";
import { GenerateMenuForm } from "@/features/planning/generate-menu-form";
import { KitchenTabs } from "@/features/planning/kitchen-tabs";
import { PlanCellAdd } from "@/features/planning/plan-cell-add";
import { RemovePlanItem } from "@/features/planning/remove-plan-item";
import { DishThumb } from "@/features/recipes/dish-thumb";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { familyRecipes } from "@/server/foods";
import { weekPlan } from "@/server/planning";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay, formatWeekday } from "@/ui/format-date";
import { Icon } from "@/ui/icon";
import { Columns } from "@/ui/columns";

/** Semaine affichée : celle du lundi demandé, ou la semaine en cours. */
function weekParam(value: unknown, today: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return isoWeekStart(today);
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoWeekStart(today) : isoWeekStart(date.toISOString().slice(0, 10));
}

export default async function PlanPage({ params, searchParams }: PageProps<"/[locale]/plan">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const weekStart = weekParam((await searchParams).week, today);
  const [items, recipes, ai] = await Promise.all([
    weekPlan(user.householdId, weekStart),
    familyRecipes(user.id),
    aiAvailability(),
  ]);
  const t = await getTranslations();
  const days = weekDates(weekStart);
  const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";
  const recipeOptions = recipes.map((recipe) => ({ id: recipe.id, name: recipe.nameFr }));
  // Tableau de l'ordinateur : déjeuner et dîner toujours, petit-déjeuner et collations seulement s'ils ont un plat.
  const gridSlots = MEAL_SLOTS.filter(
    (slot) => slot === "lunch" || slot === "dinner" || items.some((item) => item.slot === slot),
  );

  return (
    <Columns>
      <AutoRefresh />
      <KitchenTabs current="menu" />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("plan.title")}</h1>
      <p className="text-text-muted">{t("plan.intro")}</p>
      <nav aria-label={t("plan.title")} className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
        {(
          [
            ["/shopping", "cart", t("plan.shopping")],
            ["/fridge", "fridge", t("plan.fridge")],
          ] as const
        ).map(([href, icon, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface px-2 py-2 text-center text-sm font-semibold hover:bg-surface-muted lg:min-h-12 lg:flex-row lg:gap-2 lg:px-4"
          >
            <span className="text-primary">
              <Icon name={icon} />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={{ pathname: "/plan", query: { week: addDays(weekStart, -7) } }}
          aria-label={t("plan.previous")}
          className="flex size-12 items-center justify-center rounded-full hover:bg-surface-muted"
        >
          <Icon name="left" />
        </Link>
        <h2 className="text-lg font-semibold">{t("plan.weekOf", { date: formatDay(weekStart, locale, "short") })}</h2>
        <Link
          href={{ pathname: "/plan", query: { week: addDays(weekStart, 7) } }}
          aria-label={t("plan.next")}
          className="flex size-12 items-center justify-center rounded-full hover:bg-surface-muted"
        >
          <Icon name="right" />
        </Link>
      </div>

      {/* Ordinateur : la semaine en tableau, un jour par colonne et un repas par ligne ; on ajoute dans la case. */}
      <div
        role="table"
        aria-label={t("plan.grid")}
        className="hidden gap-2 lg:grid lg:grid-cols-[6rem_repeat(7,minmax(0,1fr))]"
      >
        <div role="row" className="contents">
          <span role="columnheader" />
          {days.map((date) => (
            <span
              key={date}
              role="columnheader"
              aria-current={date === today ? "date" : undefined}
              className={`px-1 pb-1 text-sm font-semibold first-letter:uppercase ${date === today ? "text-primary" : ""}`}
            >
              {formatWeekday(date, locale)} {Number(date.slice(8))}
            </span>
          ))}
        </div>
        {gridSlots.map((slot) => (
          <div key={slot} role="row" className="contents">
            <span role="rowheader" className="self-center text-sm font-semibold text-text-muted">
              {t(`slots.${slot}`)}
            </span>
            {days.map((date) => {
              const cellItems = items.filter((item) => item.date === date && item.slot === slot);
              const dayLabel = formatDay(date, locale);
              return (
                <div key={date} role="cell" className="flex min-w-0 flex-col gap-1">
                  {cellItems.map((item) => {
                    const catalog = item.catalogRef ? catalogRecipeFor(item.catalogRef) : undefined;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col overflow-hidden rounded-2xl bg-surface ${date === today ? "ring-2 ring-primary" : ""}`}
                      >
                        {(catalog || item.imageUrl) && (
                          <DishThumb catalog={catalog} imageUrl={item.imageUrl} sizes="140px" />
                        )}
                        <div className="flex flex-col gap-0.5 p-2">
                          <span className="line-clamp-2 text-sm leading-snug font-semibold">{item.label}</span>
                          <span className="text-xs text-text-muted">
                            {t("plan.servings", { count: item.servings })}
                          </span>
                          <div className="flex items-center justify-between gap-1 text-sm">
                            {item.foodId && date <= today ? (
                              <Link
                                href={{
                                  pathname: `/foods/${item.foodId}`,
                                  query: { date, slot: item.slot },
                                }}
                                aria-label={t("plan.serveLabel", { name: item.label })}
                                className={linkClass}
                              >
                                {t("plan.serve")}
                              </Link>
                            ) : (
                              <span />
                            )}
                            <RemovePlanItem id={item.id} name={item.label} compact />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <PlanCellAdd
                    date={date}
                    slot={slot}
                    dayLabel={dayLabel}
                    recipes={recipeOptions}
                    filled={cellItems.length > 0}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ol data-col className="flex flex-col gap-3 lg:hidden">
        {days.map((date) => {
          const dayItems = items.filter((item) => item.date === date);
          const label = formatDay(date, locale);
          return (
            <li key={date}>
              <Card aria-label={label} className={date === today ? "border-primary" : ""}>
                <h3 className="font-semibold first-letter:uppercase">{label}</h3>
                {dayItems.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("plan.empty")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {dayItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 py-2">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm text-text-muted">{t(`slots.${item.slot}`)}</span>
                          <span className="font-semibold">{item.label}</span>
                          <span className="text-sm text-text-muted">
                            {t("plan.servings", { count: item.servings })}
                            {item.kcalPerServing !== null &&
                              ` · ${t("plan.perServing", { kcal: item.kcalPerServing })}`}
                          </span>
                        </span>
                        {item.foodId && date <= today && (
                          <Link
                            href={{
                              pathname: `/foods/${item.foodId}`,
                              query: { date, slot: item.slot },
                            }}
                            aria-label={t("plan.serveLabel", { name: item.label })}
                            className={linkClass}
                          >
                            {t("plan.serve")}
                          </Link>
                        )}
                        <RemovePlanItem id={item.id} name={item.label} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <Card aria-labelledby="add-title" className="lg:hidden">
        <h2 id="add-title" className="text-xl font-semibold">
          {t("plan.addTitle")}
        </h2>
        <AddPlanItemForm
          days={days.map((date) => ({ date, label: formatDay(date, locale) }))}
          defaultDate={days.includes(today) ? today : days[0]!}
          recipes={recipeOptions}
        />
      </Card>

      {ai && (
        <Card aria-labelledby="generate-title">
          <h2 id="generate-title" className="text-xl font-semibold">
            {t("plan.generateTitle")}
          </h2>
          <GenerateMenuForm weekStart={weekStart} disabledReason={ai.available ? null : ai.reason} />
        </Card>
      )}
    </Columns>
  );
}
