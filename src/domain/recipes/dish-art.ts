/**
 * Illustrations de plats dessinées pour l'app : un récipient vu de dessus et des couches
 * d'ingrédients stylisés. La disposition est calculée ici (calcul pur, reproductible grâce à
 * une graine), le composant ne fait que la traduire en SVG.
 */

export const VESSELS = ["plate", "bowl", "board", "pan", "dish", "mug", "jar"] as const;
export type Vessel = (typeof VESSELS)[number];

export const SHAPES = [
  "dot",
  "grain",
  "leaf",
  "herb",
  "slice",
  "half",
  "cube",
  "strip",
  "noodle",
  "pasta",
  "bean",
  "fillet",
  "egg",
  "wedge",
  "floret",
  "berry",
  "crumb",
  "bread",
  "ring",
  "seed",
  "shrimp",
  "nut",
] as const;
export type Shape = (typeof SHAPES)[number];

/** Zone du récipient : tout, une moitié, le centre, ou une part (`sector:1/4`). */
export type Area = "all" | "left" | "right" | "top" | "bottom" | "center" | "ring" | `sector:${number}/${number}`;

export type Layer =
  /** Fond du récipient : soupe, sauce, porridge, gratin… (`cover` : part du rayon couverte). */
  | { fill: string; cover?: number; texture?: "smooth" | "grainy" | "crust" }
  /** Ingrédients éparpillés dans une zone. */
  | { shape: Shape; color: string; count: number; size?: number; area?: Area; accent?: string }
  /** Filet de sauce, de crème ou de miel. */
  | { drizzle: string };

export type DishArtSpec = {
  vessel: Vessel;
  /** Couleur de fond de la vignette (teinte pastel). */
  backdrop: string;
  layers: readonly Layer[];
};

export type Point = { x: number; y: number };

export type Piece = {
  shape: Shape;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  accent?: string;
};

export type DrawnLayer =
  | { kind: "fill"; color: string; radius: number; texture: "smooth" | "grainy" | "crust"; specks: Point[] }
  | { kind: "pieces"; pieces: Piece[] }
  | { kind: "drizzle"; color: string; path: string };

/** Taille de la vignette et centre du récipient. */
export const ART_WIDTH = 160;
export const ART_HEIGHT = 120;
export const CENTER: Point = { x: 80, y: 62 };
/** Les tailles des recettes sont données à l'échelle 1 ; on les grossit un peu pour la lisibilité. */
const PIECE_SCALE = 1.4;

/** Rayon utile (intérieur du récipient) où se posent les ingrédients. */
export function innerRadius(vessel: Vessel): number {
  switch (vessel) {
    case "plate":
      return 38;
    case "bowl":
    case "mug":
    case "jar":
      return 34;
    case "pan":
      return 36;
    case "board":
    case "dish":
      return 38;
  }
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) à partir d'un texte. */
export function seededRandom(seed: string): () => number {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le point (relatif au centre, rayon `radius`) appartient-il à la zone ? */
export function inArea(area: Area, dx: number, dy: number, radius: number): boolean {
  const distance = Math.hypot(dx, dy);
  if (distance > radius) return false;
  switch (area) {
    case "all":
      return true;
    case "left":
      return dx < -radius * 0.08;
    case "right":
      return dx > radius * 0.08;
    case "top":
      return dy < -radius * 0.08;
    case "bottom":
      return dy > radius * 0.08;
    case "center":
      return distance < radius * 0.5;
    case "ring":
      return distance > radius * 0.55;
    default: {
      const [index, total] = area.slice("sector:".length).split("/").map(Number) as [number, number];
      if (distance < radius * 0.18) return false;
      const angle = (Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2);
      const span = (Math.PI * 2) / total;
      return angle >= index * span + 0.08 && angle < (index + 1) * span - 0.08;
    }
  }
}

/**
 * Place `count` éléments dans la zone, en évitant qu'ils se chevauchent trop (échantillonnage
 * avec rejet, puis on accepte un peu de chevauchement si la zone est pleine).
 */
function scatter(random: () => number, count: number, size: number, area: Area, radius: number): Point[] {
  const placed: Point[] = [];
  const limit = radius - size * 0.45;
  for (let attempt = 0; placed.length < count && attempt < count * 60; attempt += 1) {
    const dx = (random() * 2 - 1) * limit;
    const dy = (random() * 2 - 1) * limit;
    if (!inArea(area, dx, dy, limit)) continue;
    const spacing = attempt < count * 40 ? size * 0.85 : size * 0.45;
    if (placed.some((point) => Math.hypot(point.x - dx, point.y - dy) < spacing)) continue;
    placed.push({ x: dx, y: dy });
  }
  return placed.map((point) => ({ x: round1(CENTER.x + point.x), y: round1(CENTER.y + point.y) }));
}

/** Calcule toutes les couches à dessiner pour un plat. */
export function layoutDish(spec: DishArtSpec, seed: string): DrawnLayer[] {
  const random = seededRandom(seed);
  const radius = innerRadius(spec.vessel);
  return spec.layers.map((layer): DrawnLayer => {
    if ("fill" in layer) {
      const fillRadius = round1(radius * (layer.cover ?? 1));
      const texture = layer.texture ?? "smooth";
      const specks = texture === "smooth" ? [] : scatter(random, texture === "crust" ? 26 : 34, 4, "all", fillRadius);
      return { kind: "fill", color: layer.fill, radius: fillRadius, texture, specks };
    }
    if ("drizzle" in layer) {
      const points = Array.from({ length: 5 }, (_, i) => ({
        x: CENTER.x - radius * 0.6 + (radius * 1.2 * i) / 4,
        y: CENTER.y + (random() * 2 - 1) * radius * 0.35,
      }));
      const path = points
        .map((point, i) => {
          if (i === 0) return `M${round1(point.x)} ${round1(point.y)}`;
          const previous = points[i - 1]!;
          const midX = round1((previous.x + point.x) / 2);
          return `Q${midX} ${round1(previous.y + (i % 2 ? -10 : 10))} ${round1(point.x)} ${round1(point.y)}`;
        })
        .join(" ");
      return { kind: "drizzle", color: layer.drizzle, path };
    }
    const size = (layer.size ?? 8) * PIECE_SCALE;
    const pieces = scatter(random, layer.count, size, layer.area ?? "all", radius).map((point) => ({
      shape: layer.shape,
      ...point,
      size: round1(size * (0.85 + random() * 0.3)),
      rotation: Math.round(random() * 360),
      color: layer.color,
      ...(layer.accent && { accent: layer.accent }),
    }));
    return { kind: "pieces", pieces };
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
