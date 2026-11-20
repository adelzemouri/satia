import "server-only";

import sharp from "sharp";

/** Largeur maximale d'une photo de recette : celle de la plus grande version du catalogue. */
const MAX_WIDTH = 960;

/**
 * Réduit une photo de recette en WebP 960 px au plus (quelques dizaines de Ko au lieu du Mo
 * d'une image générée brute). Renvoie null si l'image n'est pas lisible : on garde alors l'originale.
 */
export async function shrinkRecipePhoto(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const output = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_WIDTH, height: (MAX_WIDTH * 3) / 4, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return new Uint8Array(output);
  } catch {
    return null;
  }
}
