import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { slotAt } from "@/domain/meals";
import { savedMealKcal } from "@/domain/saved-meals";
import { ShareSavedMealForm } from "@/features/saved-meals/share-saved-meal-form";
import { toLocale } from "@/i18n/routing";
import { DomainError } from "@/server/errors";
import { otherMembers } from "@/server/family";
import { getSavedMeal } from "@/server/saved-meals";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

/** Partager un repas de « Mes repas » : chaque membre choisi le reçoit à valider, avec sa portion. */
export default async function ShareSavedMealPage({ params }: PageProps<"/[locale]/meals/[id]/share">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [meal, members] = await Promise.all([
    getSavedMeal(user.id, id).catch((error: unknown) => {
      if (error instanceof DomainError || (error instanceof Error && error.name === "ZodError")) notFound();
      throw error;
    }),
    otherMembers(user.id, user.householdId),
  ]);
  const t = await getTranslations();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {t("savedMeals.shareTitle", { name: meal.name })}
      </h1>
      <p className="text-text-muted">{t("savedMeals.shareIntro")}</p>
      <Card>
        <ShareSavedMealForm
          id={meal.id}
          summary={`${meal.items.map((item) => item.label).join(", ")} · ${t("common.kcal", { value: savedMealKcal(meal.items) })}`}
          date={todayIso()}
          slot={slotAt(new Date(), APP_TIMEZONE)}
          members={members}
        />
      </Card>
    </>
  );
}
