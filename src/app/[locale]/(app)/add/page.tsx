import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS, slotAt } from "@/domain/meals";
import { FoodPicker } from "@/features/foods/food-picker";
import type { FoodItem } from "@/features/foods/food-types";
import { SlotSelect } from "@/features/foods/slot-select";
import { HabitualMealCard } from "@/features/quality/habitual-meal-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { suggestedDish } from "@/server/coach";
import { catalogRecipe } from "@/domain/recipes/catalog";
import { RecipeVisual } from "@/features/recipes/recipe-visual";
import { daySummary } from "@/server/journal";
import { familyRecipes, favoriteFoods, type FoodSummary, getFood, ownFoods, recentFoods } from "@/server/foods";
import { listContainers } from "@/server/personal";
import { habitualMeal } from "@/server/quality";
import { listSavedMeals } from "@/server/saved-meals";
import { savedMealKcal } from "@/domain/saved-meals";
import { SavedMealList } from "@/features/saved-meals/saved-meal-list";
import { requireUser } from "@/server/session";
import { Icon } from "@/ui/icon";

function toItem<T extends FoodSummary>(food: T): T & FoodItem {
  return { ...food };
}

export default async function AddPage({ params, searchParams }: PageProps<"/[locale]/add">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot) ?? slotAt(new Date(), APP_TIMEZONE);
  const foodId = typeof query.food === "string" ? query.food : null;
  const [recent, favorites, mine, family, preselected, availability, containers, habit, summary, saved] =
    await Promise.all([
      recentFoods(user.id),
      favoriteFoods(user.id),
      ownFoods(user.id),
      familyRecipes(user.id),
      // Aliment choisi depuis une fiche produit : on passe directement à la quantité.
      foodId && /^[0-9a-f-]{36}$/.test(foodId) ? getFood(user.id, foodId).catch(() => null) : null,
      aiAvailability(),
      listContainers(user.id),
      foodId ? null : habitualMeal(user.id, slot, date),
      date === todayIso() && !foodId ? daySummary(user.id, date) : null,
      foodId ? [] : listSavedMeals(user.id),
    ]);
  // Une idée de plat qui tient dans ce qu'il reste aujourd'hui, si aucun repas habituel ne se présente.
  const dish =
    !habit && summary?.goal
      ? await suggestedDish(
          user.id,
          { slot, goalKcal: summary.goal.kcal, remainingKcal: summary.goal.kcal - summary.totals.kcal },
          date,
        )
      : null;
  const catalogDish = dish?.catalogSlug ? catalogRecipe(dish.catalogSlug) : undefined;
  const t = await getTranslations("add");
  const tAll = await getTranslations();

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <SlotSelect date={date} slot={slot} />
      </header>
      <FoodPicker
        // Une idée de plat ouvre la même page avec ?food= : le sélecteur repart de cet aliment.
        key={preselected?.id ?? "search"}
        date={date}
        slot={slot}
        recent={recent.map(toItem)}
        favorites={favorites.map(toItem)}
        mine={[...mine, ...family].map(toItem)}
        initialFood={preselected && toItem(preselected)}
        inputMethod={query.via === "barcode" ? "barcode" : "manual"}
        ai={availability ? { availability, containers: containers.map(({ id, name }) => ({ id, name })) } : undefined}
        suggestions={
          <>
            {saved.length > 0 && (
              <SavedMealList
                date={date}
                slot={slot}
                meals={saved.map((meal) => ({
                  id: meal.id,
                  name: meal.name,
                  labels: meal.items.map((item) => item.label),
                  kcal: savedMealKcal(meal.items),
                }))}
              />
            )}
            {habit ? (
              <HabitualMealCard meal={habit} date={date} />
            ) : (
              dish && (
                <Link
                  href={{ pathname: "/add", query: { food: dish.id, slot, date } }}
                  className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-primary-soft px-4 py-3"
                >
                  {catalogDish && (
                    <span className="w-20 shrink-0 overflow-hidden rounded-xl">
                      <RecipeVisual recipe={catalogDish} sizes="80px" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-bold text-primary">{tAll("coach.suggestionTitle", { slot })}</span>
                    <span className="font-bold">{dish.name}</span>
                    <span className="text-sm">{tAll("common.kcal", { value: dish.portionKcal })}</span>
                  </span>
                  <span className="text-primary">
                    <Icon name="right" />
                  </span>
                  <span className="sr-only">{tAll("coach.suggestionAdd", { name: dish.name })}</span>
                </Link>
              )
            )}
          </>
        }
      />
    </>
  );
}
