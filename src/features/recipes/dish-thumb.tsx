import type { CatalogRecipe } from "@/domain/recipes/catalog";

import { RecipeVisual } from "./recipe-visual";

/**
 * Vignette d'un plat proposé : la photo de la recette du catalogue, sinon celle du plat, sinon
 * une assiette dessinée (recette de la famille ou du menu, qui n'a pas d'image).
 */
export function DishThumb({
  catalog,
  imageUrl,
  sizes = "80px",
}: {
  catalog?: Pick<CatalogRecipe, "slug" | "art">;
  imageUrl?: string | null;
  sizes?: string;
}) {
  if (catalog) return <RecipeVisual recipe={catalog} imageUrl={imageUrl} sizes={sizes} />;
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image du plat (Open Food Facts ou stockage privé)
      <img src={imageUrl} alt="" loading="lazy" className="block aspect-[4/3] h-auto w-full object-cover" />
    );
  }
  return (
    <span className="flex aspect-[4/3] w-full items-center justify-center bg-surface text-primary">
      <svg
        aria-hidden="true"
        viewBox="0 0 96 72"
        className="h-3/4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="48" cy="38" r="20" />
        <circle cx="48" cy="38" r="13" />
        <path d="M18 22v10a4 4 0 0 0 4 4v18M22 22v10M26 22v10a4 4 0 0 1-4 4M76 22c-4 3-5 8-5 14h5v18" />
      </svg>
    </span>
  );
}
