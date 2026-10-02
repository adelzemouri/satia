import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS, slotAt } from "@/domain/meals";
import type { AiAvailability } from "@/features/ai/ai-entry";
import { FoodPicker } from "@/features/foods/food-picker";
import type { FoodItem } from "@/features/foods/food-types";
import { toLocale } from "@/i18n/routing";
import { llmConfig } from "@/llm/config";
import { aiStatus } from "@/llm/guard";
import { favoriteFoods, type FoodSummary, getFood, ownFoods, recentFoods } from "@/server/foods";
import { listContainers } from "@/server/personal";
import { requireUser } from "@/server/session";

function toItem(food: FoodSummary): FoodItem {
  return { ...food };
}

/** Saisie IA proposée si elle est configurée ; sinon la raison est affichée (pause, plafond atteint). */
async function aiAvailability(): Promise<AiAvailability | null> {
  const status = await aiStatus(llmConfig());
  if (!status.configured) return null;
  if (!status.enabled) return { available: false, reason: "ai_disabled" };
  if (status.spentUsdMicros >= status.budgetUsd * 1_000_000) return { available: false, reason: "ai_budget_reached" };
  return { available: true };
}

export default async function AddPage({ params, searchParams }: PageProps<"/[locale]/add">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot) ?? slotAt(new Date(), APP_TIMEZONE);
  const foodId = typeof query.food === "string" ? query.food : null;
  const [recent, favorites, mine, preselected, availability, containers] = await Promise.all([
    recentFoods(user.id),
    favoriteFoods(user.id),
    ownFoods(user.id),
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
        mine={mine.map(toItem)}
        initialFood={preselected && toItem(preselected)}
        inputMethod={query.via === "barcode" ? "barcode" : "manual"}
        ai={availability ? { availability, containers: containers.map(({ id, name }) => ({ id, name })) } : undefined}
      />
    </>
  );
}
