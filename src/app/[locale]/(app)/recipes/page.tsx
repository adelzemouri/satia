import { getTranslations, setRequestLocale } from "next-intl/server";

import { RECIPE_CATEGORIES } from "@/domain/recipes/catalog";
import { KitchenTabs } from "@/features/planning/kitchen-tabs";
import { HouseholdRecipeCard } from "@/features/recipes/household-recipe-card";
import { RecipeCard } from "@/features/recipes/recipe-card";
import { RecipeFilter } from "@/features/recipes/recipe-filter";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { recipeLibrary } from "@/server/planning";
import { catalogEntries } from "@/server/recipes";
import { fillRecipePhotosLater } from "@/server/foods";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";

/** Les recettes de la famille n'ont pas de catégorie : elles s'affichent sous « Toutes », en tête. */
const OURS = "ours";

export default async function RecipesPage({ params, searchParams }: PageProps<"/[locale]/recipes">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const { cat } = await searchParams;
  const category = RECIPE_CATEGORIES.find((value) => value === cat);
  const [recipes, catalog] = await Promise.all([recipeLibrary(user.id, user.householdId), catalogEntries()]);
  // Recettes du foyer encore sans photo : l'IA en prépare quelques-unes après l'affichage.
  fillRecipePhotosLater(user.id);
  const t = await getTranslations("recipes");
  // Une seule bibliothèque : les recettes de la famille d'abord, puis les idées Pommelia.
  const ours = recipes.map((recipe) => ({
    key: recipe.id,
    category: OURS,
    text: recipe.name,
    card: (
      <HouseholdRecipeCard
        id={recipe.id}
        name={recipe.name}
        imageUrl={recipe.imageUrl}
        portionKcal={Math.round((Number(recipe.kcal) * (recipe.unitWeights?.portion ?? 100)) / 100)}
        servings={recipe.servings ?? 1}
      />
    ),
  }));
  const ideas = catalog.map((entry) => ({
    key: entry.id,
    category: entry.recipe.category,
    text: [entry.recipe.name, ...entry.recipe.ingredients.map(([, , label]) => label)].join(" "),
    card: <RecipeCard id={entry.id} recipe={entry.recipe} portionKcal={entry.portionKcal} />,
  }));
  const categories = RECIPE_CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }));

  return (
    <>
      <KitchenTabs current="recipes" />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>
      <Link
        href={{ pathname: "/foods/new-recipe", query: { family: "1" } }}
        className={buttonClass("secondary", "self-start px-4")}
      >
        {t("new")}
      </Link>
      {ours.length + ideas.length === 0 ? (
        <p className="text-text-muted">{t("none")}</p>
      ) : (
        <RecipeFilter
          label={t("filterLabel")}
          allLabel={t("all")}
          searchLabel={t("search")}
          noMatch={t("noMatch")}
          categories={categories}
          initial={category ?? null}
          items={[...ours, ...ideas]}
        />
      )}
    </>
  );
}
