import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS, slotAt } from "@/domain/meals";
import { ShareMealForm } from "@/features/family/share-meal-form";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { otherMembers } from "@/server/family";
import { familyRecipes, getFood } from "@/server/foods";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function ShareMealPage({ params, searchParams }: PageProps<"/[locale]/family/share">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot) ?? slotAt(new Date(), APP_TIMEZONE);
  const foodId = typeof query.food === "string" && /^[0-9a-f-]{36}$/.test(query.food) ? query.food : null;
  const [members, recipes, ai, initialDish] = await Promise.all([
    otherMembers(user.id, user.householdId),
    familyRecipes(user.id),
    aiAvailability(),
    foodId ? getFood(user.id, foodId).catch(() => null) : null,
  ]);
  const t = await getTranslations("family");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("shareTitle")}</h1>
      <p className="text-text-muted">{t("shareIntro")}</p>
      <Card>
        <ShareMealForm
          date={date}
          slot={slot}
          members={members}
          recipes={recipes.map(({ ownerUserId: _owner, ...food }) => food)}
          aiAvailable={ai?.available === true}
          initialDish={initialDish && (({ ownerUserId: _owner, ...food }) => food)(initialDish)}
        />
      </Card>
    </>
  );
}
