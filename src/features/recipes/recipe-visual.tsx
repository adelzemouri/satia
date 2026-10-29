import { type ReactElement, ViewTransition } from "react";

import type { CatalogRecipe } from "@/domain/recipes/catalog";

import { DishArt } from "./dish-art";
import { RECIPE_PHOTOS } from "./recipe-photos";

/** Photo rangée dans le stockage privé (refaite par l'admin), et non fichier livré avec l'app. */
export function storedPhotoUrl(imageUrl: string | null | undefined): string | null {
  return imageUrl?.startsWith("/api/foods/") ? imageUrl : null;
}

/**
 * Photo d'une recette du catalogue à ouvrir en grand (la visionneuse prend la version 960 px),
 * ou `null` quand la recette n'a que son illustration dessinée.
 */
export function recipePhotoSrc(
  recipe: Pick<CatalogRecipe, "slug">,
  imageUrl: string | null | undefined,
): string | null {
  const stored = storedPhotoUrl(imageUrl);
  if (stored) return stored;
  return RECIPE_PHOTOS.has(recipe.slug) ? `/recipes/${recipe.slug}-480.webp` : null;
}

/**
 * Visuel d'une recette du catalogue : la photo refaite par l'admin s'il y en a une, sinon sa
 * photo d'origine (générée pour l'app, servie en WebP dans deux tailles), ou l'illustration
 * dessinée si la recette n'a pas encore de photo.
 */
export function RecipeVisual({
  recipe,
  imageUrl,
  sizes = "(min-width: 640px) 220px, 45vw",
  priority = false,
  morph = false,
}: {
  recipe: Pick<CatalogRecipe, "slug" | "art">;
  /** `foods.image_url` de la recette, qui pointe vers la photo refaite quand il y en a une. */
  imageUrl?: string | null;
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
  const visual = picture(recipe, sizes, priority, storedPhotoUrl(imageUrl));
  if (!morph) return visual;
  return (
    <ViewTransition name={`recipe-${recipe.slug}`} share="morph" default="none">
      {visual}
    </ViewTransition>
  );
}

function picture(
  recipe: Pick<CatalogRecipe, "slug" | "art">,
  sizes: string,
  priority: boolean,
  stored: string | null,
): ReactElement {
  if (stored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par URL signée
      <img
        src={stored}
        width={480}
        height={360}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block aspect-[4/3] h-auto w-full object-cover"
      />
    );
  }
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
