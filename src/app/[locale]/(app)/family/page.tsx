import { getTranslations, setRequestLocale } from "next-intl/server";

import { FamilyRecipeList } from "@/features/family/family-recipe-list";
import { PendingShares } from "@/features/family/pending-shares";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { pendingShares } from "@/server/family";
import { familyRecipes, favoriteIds } from "@/server/foods";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

export default async function FamilyPage({ params }: PageProps<"/[locale]/family">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [shares, recipes, favorites] = await Promise.all([
    pendingShares(user.id),
    familyRecipes(user.id),
    favoriteIds(user.id),
  ]);
  const t = await getTranslations("family");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>

      {shares.length > 0 && (
        <Card aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-xl font-semibold">
            {t("pendingTitle")}
          </h2>
          <PendingShares shares={shares} />
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/family/share" className={buttonClass("primary")}>
          {t("shareDish")}
        </Link>
        <Link href={{ pathname: "/foods/new-recipe", query: { family: "1" } }} className={buttonClass("secondary")}>
          {t("newRecipe")}
        </Link>
      </div>

      <Card aria-labelledby="recipes-title">
        <h2 id="recipes-title" className="text-xl font-semibold">
          {t("recipesTitle")}
        </h2>
        {recipes.length === 0 ? (
          <p className="text-text-muted">{t("noRecipes")}</p>
        ) : (
          <FamilyRecipeList recipes={recipes} favoriteIds={[...favorites]} />
        )}
      </Card>
    </>
  );
}
