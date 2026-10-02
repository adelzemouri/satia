import { AI_IMAGE_MAX_SIDE, fitWithin } from "@/domain/image-size";

export type CompressedImage = { blob: Blob; mime: "image/webp" | "image/jpeg"; width: number; height: number };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Réduit une photo dans le navigateur avant l'envoi au LLM : côté long ≤ 768 px, en WebP
 * (qualité 0,7), ou en JPEG quand le navigateur ne sait pas encoder le WebP (Safari).
 * L'orientation EXIF est appliquée, et les métadonnées (lieu, appareil) disparaissent.
 */
export async function compressImage(
  file: Blob,
  { maxSide = AI_IMAGE_MAX_SIDE, quality = 0.7 } = {},
): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") return { blob: webp, mime: "image/webp", width, height };
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("encode_failed");
  return { blob: jpeg, mime: "image/jpeg", width, height };
}
