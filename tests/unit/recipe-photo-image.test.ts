import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { shrinkRecipePhoto } = await import("@/server/recipe-photo-image");

describe("shrinkRecipePhoto", () => {
  it("réduit une grande image générée en WebP de 960 px au plus", async () => {
    const png = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c0563a" } })
      .png()
      .toBuffer();
    const small = await shrinkRecipePhoto(new Uint8Array(png));
    const meta = await sharp(small!).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 960, height: 720 });
  });

  it("n'agrandit pas une petite image", async () => {
    const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#fff" } })
      .jpeg()
      .toBuffer();
    const meta = await sharp((await shrinkRecipePhoto(new Uint8Array(jpeg)))!).metadata();
    expect(meta).toMatchObject({ width: 400, height: 300 });
  });

  it("garde l'originale quand l'image est illisible", async () => {
    expect(await shrinkRecipePhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 1]))).toBeNull();
  });
});
