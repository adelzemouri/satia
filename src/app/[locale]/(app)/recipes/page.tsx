import { getTranslations, setRequestLocale } from "next-intl/server";

import { RECIPE_CATEGORIES } from "@/domain/recipes/catalog";
import { RecipeCard } from "@/features/recipes/recipe-card";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { recipeLibrary } from "@/server/planning";
import { catalogEntries } from "@/server/recipes";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

export default async function RecipesPage({ params, searchParams }: PageProps<"/[locale]/recipes">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const { cat } = await searchParams;
  const category = RECIPE_CATEGORIES.find((value) => value === cat);
  const [recipes, catalog] = await Promise.all([recipeLibrary(user.id, user.householdId), catalogEntries()]);
  const t = await getTranslations("recipes");
  const sections = [
    { id: "mine", title: t("mine"), list: recipes.filter((recipe) => recipe.ownerUserId === user.id) },
    { id: "family", title: t("family"), list: recipes.filter((recipe) => recipe.ownerUserId === null) },
  ];
  const ideas = catalog.filter((entry) => !category || entry.recipe.category === category);
  const chip = (active: boolean) =>
    `flex min-h-11 items-center rounded-full px-4 font-semibold ${
      active ? "bg-primary text-on-primary" : "bg-surface text-text"
    }`;

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/foods/new-recipe" className={buttonClass("secondary", "px-4")}>
          {t("new")}
        </Link>
        <Link
          href={{ pathname: "/foods/new-recipe", query: { family: "1" } }}
          className={buttonClass("secondary", "px-4")}
        >
          {t("newFamily")}
        </Link>
      </div>
      {sections.map(
        (section) =>
          // Sans recette de la famille, le catalogue suffit à remplir la page.
          (section.list.length > 0 || catalog.length === 0) && (
            <Card key={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`} className="text-xl font-semibold">
                {section.title}
              </h2>
              {section.list.length === 0 ? (
                <p className="text-text-muted">{t("none")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {section.list.map((recipe) => {
                    const portion = recipe.unitWeights?.portion ?? 100;
                    return (
                      <li key={recipe.id} className="flex items-center gap-2 py-2">
                        <Link href={`/foods/${recipe.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                          <span className="font-semibold">{recipe.name}</span>
                          <span className="text-sm text-text-muted">
                            {t("perServing", {
                              kcal: Math.round((Number(recipe.kcal) * portion) / 100),
                              count: recipe.servings ?? 1,
                            })}
                          </span>
                        </Link>
                        <Link
                          href={`/foods/${recipe.id}/edit`}
                          aria-label={t("editLabel", { name: recipe.name })}
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          {t("edit")}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ),
      )}
      {catalog.length > 0 && (
        <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
          <h2 id="ideas-title" className="font-display text-2xl font-extrabold tracking-tight">
            {t("ideas")}
          </h2>
          <p className="text-text-muted">{t("ideasIntro")}</p>
          <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2">
              <li>
                <Link href="/recipes" aria-current={!category ? "page" : undefined} className={chip(!category)}>
                  {t("all")}
                </Link>
              </li>
              {RECIPE_CATEGORIES.map((value) => (
                <li key={value}>
                  <Link
                    href={{ pathname: "/recipes", query: { cat: value } }}
                    aria-current={category === value ? "page" : undefined}
                    className={`${chip(category === value)} whitespace-nowrap`}
                  >
                    {t(`categories.${value}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ideas.map((entry) => (
              <li key={entry.id} className="flex">
                <RecipeCard id={entry.id} recipe={entry.recipe} portionKcal={entry.portionKcal} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
