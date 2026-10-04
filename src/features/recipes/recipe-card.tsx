import { useTranslations } from "next-intl";

import type { CatalogRecipe } from "@/domain/recipes/catalog";
import { NAV_FORWARD } from "@/features/navigation/transition-types";
import { Link } from "@/i18n/navigation";

import { RecipeVisual } from "./recipe-visual";

/** Vignette d'une recette du catalogue : photo, nom, calories et temps. */
export function RecipeCard({
  id,
  recipe,
  portionKcal,
  query,
}: {
  id: string;
  recipe: CatalogRecipe;
  portionKcal: number;
  query?: Record<string, string>;
}) {
  const t = useTranslations("recipes");
  return (
    <Link
      href={{ pathname: `/foods/${id}`, query }}
      transitionTypes={NAV_FORWARD}
      className="flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface"
    >
      <RecipeVisual recipe={recipe} morph />
      <span className="flex flex-col gap-0.5 px-3 py-2">
        <span className="leading-snug font-bold">{recipe.name}</span>
        <span className="text-sm text-text-muted">{t("card", { kcal: portionKcal, minutes: recipe.minutes })}</span>
      </span>
    </Link>
  );
}
