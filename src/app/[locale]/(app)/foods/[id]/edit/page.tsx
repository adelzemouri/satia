import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { RecipeForm } from "@/features/foods/recipe-form";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { DomainError } from "@/server/errors";
import { getRecipeForEdit } from "@/server/foods";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function EditRecipePage({ params }: PageProps<"/[locale]/foods/[id]/edit">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const recipe = await getRecipeForEdit(user.id, id).catch((error: unknown) => {
    if (error instanceof DomainError || (error instanceof Error && error.name === "ZodError")) notFound();
    throw error;
  });
  const ai = await aiAvailability();
  const t = await getTranslations("foods");
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("editRecipe")}</h1>
      <Card>
        <RecipeForm
          initial={{
            ...recipe,
            items: recipe.items.map(({ food: { ownerUserId: _owner, ...food }, grams }) => ({ food, grams })),
          }}
          aiAvailable={ai?.available === true}
        />
      </Card>
    </>
  );
}
