import { type ReactElement, ViewTransition } from "react";

import type { CatalogRecipe } from "@/domain/recipes/catalog";

import { DishArt } from "./dish-art";
import { RECIPE_PHOTOS } from "./recipe-photos";

/**
 * Visuel d'une recette du catalogue : sa photo (générée pour l'app, servie en WebP dans deux
 * tailles), ou l'illustration dessinée si la recette n'a pas encore de photo.
 */
export function RecipeVisual({
  recipe,
  sizes = "(min-width: 640px) 220px, 45vw",
  priority = false,
  morph = false,
}: {
  recipe: Pick<CatalogRecipe, "slug" | "art">;
  /** Largeur affichée, pour que le navigateur choisisse la bonne taille. */
  sizes?: string;
  /** Image principale de la page : chargée tout de suite. */
  priority?: boolean;
  /**
   * Vignette ou image principale d'une fiche : la photo s'agrandit de l'une à l'autre en
   * changeant de page. Une seule par recette et par page, le nom devant être unique.
   */
  morph?: boolean;
}) {
  const visual = picture(recipe, sizes, priority);
  if (!morph) return visual;
  return (
    <ViewTransition name={`recipe-${recipe.slug}`} share="morph" default="none">
      {visual}
    </ViewTransition>
  );
}

function picture(recipe: Pick<CatalogRecipe, "slug" | "art">, sizes: string, priority: boolean): ReactElement {
  if (!RECIPE_PHOTOS.has(recipe.slug)) return <DishArt spec={recipe.art} seed={recipe.slug} />;
  const base = `/recipes/${recipe.slug}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fichiers déjà redimensionnés en WebP
    <img
      src={`${base}-480.webp`}
      srcSet={`${base}-480.webp 480w, ${base}-960.webp 960w`}
      sizes={sizes}
      width={480}
      height={360}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="block aspect-[4/3] h-auto w-full object-cover"
    />
  );
}
