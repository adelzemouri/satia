import { describe, expect, it } from "vitest";

import { fitWithin, fullSizeImageUrl } from "@/domain/image-size";

describe("fitWithin", () => {
  it("réduit le côté long sans agrandir une petite image", () => {
    expect(fitWithin(3000, 2000)).toEqual({ width: 768, height: 512 });
    expect(fitWithin(400, 300)).toEqual({ width: 400, height: 300 });
  });
});

describe("fullSizeImageUrl", () => {
  it("demande l'original d'une vignette Open Food Facts", () => {
    expect(
      fullSizeImageUrl("https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.633.200.jpg"),
    ).toBe("https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.633.full.jpg");
    expect(fullSizeImageUrl("https://images.openfoodfacts.org/images/products/123/front_en.4.400.jpg")).toBe(
      "https://images.openfoodfacts.org/images/products/123/front_en.4.full.jpg",
    );
  });

  it("prend le WebP 960 px d'une recette de l'app", () => {
    expect(fullSizeImageUrl("/recipes/curry-de-lentilles-480.webp")).toBe("/recipes/curry-de-lentilles-960.webp");
  });

  it("laisse les autres images telles quelles", () => {
    for (const src of [
      "/api/foods/abc/photo",
      "https://bucket.r2.cloudflarestorage.com/meals/1.webp?X-Amz-Signature=abc",
      "https://images.openfoodfacts.org/images/products/123/front_fr.4.full.jpg",
      "https://evil.example/images/products/123/front_fr.4.200.jpg",
    ])
      expect(fullSizeImageUrl(src)).toBe(src);
  });
});
