import { useTranslations } from "next-intl";

import type { CatalogRecipe } from "@/domain/recipes/catalog";
import { Link } from "@/i18n/navigation";

import { RecipeVisual } from "./recipe-visual";

/** Vignette d'une recette du catalogue : photo, nom, calories et temps. */
export function RecipeCard({
  id,
  recipe,
  portionKcal,
  imageUrl,
  query,
}: {
  id: string;
  recipe: CatalogRecipe;
  imageUrl?: string | null;
  portionKcal: number;
  query?: Record<string, string>;
}) {
  const t = useTranslations("recipes");
  return (
    <Link
      href={{ pathname: `/foods/${id}`, query }}
      className="flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface"
    >
      <RecipeVisual
        recipe={recipe}
        imageUrl={imageUrl}
        sizes="(min-width: 1024px) 180px, (min-width: 640px) 220px, 45vw"
        morph
      />
      <span className="flex flex-col gap-0.5 px-3 py-2">
        <span className="leading-snug font-bold lg:line-clamp-2">{recipe.name}</span>
        <span className="text-sm text-text-muted">{t("card", { kcal: portionKcal, minutes: recipe.minutes })}</span>
      </span>
    </Link>
  );
}
