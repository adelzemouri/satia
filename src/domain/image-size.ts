/** Côté long maximal des photos envoyées au LLM (moins de pixels, moins de tokens). */
export const AI_IMAGE_MAX_SIDE = 768;

/** Dimensions réduites en gardant les proportions ; une image déjà petite n'est pas agrandie. */
export function fitWithin(width: number, height: number, maxSide = AI_IMAGE_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
