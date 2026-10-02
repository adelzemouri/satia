import { getTranslations, setRequestLocale } from "next-intl/server";

import { RecipeForm } from "@/features/foods/recipe-form";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function NewRecipePage({ params }: PageProps<"/[locale]/foods/new-recipe">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations("foods");
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("newRecipe")}</h1>
      <Card>
        <RecipeForm />
      </Card>
    </>
  );
}
