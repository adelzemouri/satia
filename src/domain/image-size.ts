/** Côté long maximal des photos envoyées au LLM (moins de pixels, moins de tokens). */
export const AI_IMAGE_MAX_SIDE = 768;

/** Dimensions réduites en gardant les proportions ; une image déjà petite n'est pas agrandie. */
export function fitWithin(width: number, height: number, maxSide = AI_IMAGE_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Version la plus nette d'une image affichée en vignette, pour la visionneuse : WebP 960 px pour
 * les recettes de l'app, original pour Open Food Facts (la vignette gardée fait environ 200 px).
 * Les autres URL (photos de la famille, URL signées) sont déjà à leur taille d'origine.
 */
export function fullSizeImageUrl(src: string): string {
  if (/^\/recipes\/[\w-]+-480\.webp$/.test(src)) return src.replace(/-480\.webp$/, "-960.webp");
  return src.replace(
    /^(https:\/\/(?:[\w-]+\.)*openfoodfacts\.org\/images\/products\/[^?#]+\.\d+)\.(?:100|200|400)\.jpg$/,
    "$1.full.jpg",
  );
}
