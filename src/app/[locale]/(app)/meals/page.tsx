import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { shortFoodName } from "@/domain/food-name";
import { slotAt } from "@/domain/meals";
import { macroSplit, savedMealKcal } from "@/domain/saved-meals";
import { MacroRing } from "@/features/saved-meals/macro-ring";
import { KitchenTabs } from "@/features/planning/kitchen-tabs";
import { SavedMealItem } from "@/features/saved-meals/saved-meal-item";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { listSavedMeals } from "@/server/saved-meals";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";

/** « Mes repas » : les repas enregistrés depuis le journal, à resservir depuis l'écran d'ajout. */
export default async function SavedMealsPage({ params }: PageProps<"/[locale]/meals">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const meals = await listSavedMeals(user.id);
  const t = await getTranslations();
  const date = todayIso();
  const slot = slotAt(new Date(), APP_TIMEZONE);

  return (
    <>
      <span data-wide hidden />
      <KitchenTabs current="meals" />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("savedMeals.title")}</h1>
      <p className="text-text-muted">{t("savedMeals.intro")}</p>
      {meals.length === 0 ? (
        <Card>
          <EmptyState
            scene="plate"
            action={
              <Link href="/journal" className={buttonClass("secondary")}>
                {t("nav.journal")}
              </Link>
            }
          >
            {t("savedMeals.empty")}
          </EmptyState>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {meals.map((meal) => {
            const kcal = savedMealKcal(meal.items);
            const split = macroSplit(meal.items);
            return (
              <SavedMealItem
                key={meal.id}
                id={meal.id}
                name={meal.name}
                date={date}
                slot={slot}
                foods={meal.items.map((item) => ({
                  label: shortFoodName(item.label),
                  amount: t("common.grams", { value: Math.round(item.grams) }),
                }))}
              >
                <div className="flex items-center gap-4">
                  <MacroRing split={split} kcal={kcal} label={t("savedMeals.ringLabel", { kcal, ...split.percent })} />
                  <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm" aria-label={t("savedMeals.macros")}>
                    {MACROS.map(([key, field, color]) => (
                      <li key={key} className="flex items-center gap-2">
                        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${color}`} />
                        <span className="min-w-0 flex-1 text-text-muted">{t(`home.${key}`)}</span>
                        <span className="font-bold tabular-nums">{t("common.grams", { value: split[field] })}</span>
                        <span className="w-10 text-right text-text-muted tabular-nums">
                          {t("savedMeals.percent", { value: split.percent[key] })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </SavedMealItem>
            );
          })}
        </ul>
      )}
    </>
  );
}

const MACROS = [
  ["protein", "proteinG", "bg-protein"],
  ["carbs", "carbsG", "bg-carbs"],
  ["fat", "fatG", "bg-fat"],
] as const;
