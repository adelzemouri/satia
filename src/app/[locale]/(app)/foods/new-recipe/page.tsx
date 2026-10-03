import { getTranslations, setRequestLocale } from "next-intl/server";

import { RecipeForm } from "@/features/foods/recipe-form";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function NewRecipePage({ params, searchParams }: PageProps<"/[locale]/foods/new-recipe">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const family = (await searchParams).family === "1";
  const ai = await aiAvailability();
  const t = await getTranslations("foods");
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("newRecipe")}</h1>
      <Card>
        <RecipeForm defaultFamily={family} aiAvailable={ai?.available === true} />
      </Card>
    </>
  );
}
