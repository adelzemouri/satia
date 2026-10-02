import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { FoodPicker } from "@/features/foods/food-picker";
import type { FoodItem } from "@/features/foods/food-types";
import { toLocale } from "@/i18n/routing";
import { favoriteFoods, type FoodSummary, ownFoods, recentFoods } from "@/server/foods";
import { requireUser } from "@/server/session";

/** Repas probable selon l'heure, quand l'écran est ouvert depuis le bouton central. */
function slotForNow(now = new Date()): MealSlot {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(now),
  );
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

function toItem(food: FoodSummary): FoodItem {
  return { ...food };
}

export default async function AddPage({ params, searchParams }: PageProps<"/[locale]/add">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot) ?? slotForNow();
  const [recent, favorites, mine] = await Promise.all([
    recentFoods(user.id),
    favoriteFoods(user.id),
    ownFoods(user.id),
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
        mine={mine.map(toItem)}
      />
    </>
  );
}
