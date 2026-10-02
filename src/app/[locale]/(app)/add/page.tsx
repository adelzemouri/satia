import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS, slotAt } from "@/domain/meals";
import { FoodPicker } from "@/features/foods/food-picker";
import type { FoodItem } from "@/features/foods/food-types";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { familyRecipes, favoriteFoods, type FoodSummary, getFood, ownFoods, recentFoods } from "@/server/foods";
import { listContainers } from "@/server/personal";
import { requireUser } from "@/server/session";

function toItem(food: FoodSummary): FoodItem {
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
  const [recent, favorites, mine, family, preselected, availability, containers] = await Promise.all([
    recentFoods(user.id),
    favoriteFoods(user.id),
    ownFoods(user.id),
    familyRecipes(user.id),
    // Aliment choisi depuis une fiche produit : on passe directement à la quantité.
    foodId && /^[0-9a-f-]{36}$/.test(foodId) ? getFood(user.id, foodId).catch(() => null) : null,
    aiAvailability(),
    listContainers(user.id),
  ]);
  const t = await getTranslations("add");

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <FoodPicker
        date={date}
        slot={slot}
        recent={recent.map(toItem)}
        favorites={favorites.map(toItem)}
        mine={[...mine, ...family].map(toItem)}
        initialFood={preselected && toItem(preselected)}
        inputMethod={query.via === "barcode" ? "barcode" : "manual"}
        ai={availability ? { availability, containers: containers.map(({ id, name }) => ({ id, name })) } : undefined}
      />
    </>
  );
}
