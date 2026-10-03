import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import { weekDates } from "@/domain/weekly-budget";
import { AddPlanItemForm } from "@/features/planning/add-plan-item-form";
import { AutoRefresh } from "@/features/planning/auto-refresh";
import { GenerateMenuForm } from "@/features/planning/generate-menu-form";
import { RemovePlanItem } from "@/features/planning/remove-plan-item";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { familyRecipes } from "@/server/foods";
import { weekPlan } from "@/server/planning";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { Icon } from "@/ui/icon";

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

  return (
    <>
      <AutoRefresh />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("plan.title")}</h1>
      <p className="text-text-muted">{t("plan.intro")}</p>
      <nav aria-label={t("plan.title")} className="flex flex-wrap gap-3">
        {(
          [
            ["/shopping", "cart", t("plan.shopping")],
            ["/recipes", "book", t("plan.recipes")],
            ["/fridge", "fridge", t("plan.fridge")],
          ] as const
        ).map(([href, icon, label]) => (
          <Link key={href} href={href} className={buttonClass("secondary", "px-4")}>
            <Icon name={icon} />
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

      <ol className="flex flex-col gap-3">
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
                              pathname: "/family/share",
                              query: { food: item.foodId, date, slot: item.slot },
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

      <Card aria-labelledby="add-title">
        <h2 id="add-title" className="text-xl font-semibold">
          {t("plan.addTitle")}
        </h2>
        <AddPlanItemForm
          days={days.map((date) => ({ date, label: formatDay(date, locale) }))}
          defaultDate={days.includes(today) ? today : days[0]!}
          recipes={recipes.map((recipe) => ({ id: recipe.id, name: recipe.nameFr }))}
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
    </>
  );
}
