import { getTranslations, setRequestLocale } from "next-intl/server";

import { savedMealKcal } from "@/domain/saved-meals";
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

  return (
    <>
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
        <ul className="flex flex-col gap-3">
          {meals.map((meal) => (
            <SavedMealItem key={meal.id} id={meal.id} name={meal.name}>
              <span className="font-bold">{meal.name}</span>
              <span className="text-sm text-text-muted">{meal.items.map((item) => item.label).join(", ")}</span>
              <span className="text-sm font-semibold">{t("common.kcal", { value: savedMealKcal(meal.items) })}</span>
            </SavedMealItem>
          ))}
        </ul>
      )}
    </>
  );
}
