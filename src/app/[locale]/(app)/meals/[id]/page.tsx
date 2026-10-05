import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SavedMealForm } from "@/features/saved-meals/saved-meal-form";
import { toLocale } from "@/i18n/routing";
import { DomainError } from "@/server/errors";
import { getSavedMeal } from "@/server/saved-meals";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

/** Modifier un repas de « Mes repas ». */
export default async function EditSavedMealPage({ params }: PageProps<"/[locale]/meals/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const meal = await getSavedMeal(user.id, id).catch((error: unknown) => {
    if (error instanceof DomainError || (error instanceof Error && error.name === "ZodError")) notFound();
    throw error;
  });
  const t = await getTranslations("savedMeals");
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("editTitle")}</h1>
      <Card>
        <SavedMealForm id={meal.id} name={meal.name} items={meal.items} />
      </Card>
    </>
  );
}
