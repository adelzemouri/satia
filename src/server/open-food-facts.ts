import "server-only";

import { z } from "zod";

import { APP_NAME } from "@/config/app";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { kcalFromMacros } from "@/domain/nutrition";
import { normalizeForSearch } from "@/domain/search";

import { DomainError } from "./errors";
import { enforceRateLimit } from "./rate-limit";

/**
 * Open Food Facts (base ouverte, licence ODbL) : recherche de produits du commerce et
 * mise en cache locale du produit choisi. L'attribution est affichée dans l'interface.
 */
const OFF_BASE = "https://world.openfoodfacts.org";
/** Moteur de recherche dédié d'OFF (« search-a-licious ») : plus rapide et prévu pour les API. */
const OFF_SEARCH_BASE = "https://search.openfoodfacts.org";
const USER_AGENT = `${APP_NAME}/0.1 (application familiale de suivi nutritionnel)`;
const FIELDS = "code,product_name,product_name_fr,brands,nutriments,serving_quantity";
const TIMEOUT_MS = 8000;
/** OFF demande de rester sous 10 recherches par minute. */
const SEARCH_RULE = { window: 60, max: 8 };

const nutrimentsSchema = z
  .object({
    "energy-kcal_100g": z.coerce.number().optional(),
    energy_100g: z.coerce.number().optional(),
    proteins_100g: z.coerce.number().optional(),
    carbohydrates_100g: z.coerce.number().optional(),
    fat_100g: z.coerce.number().optional(),
    fiber_100g: z.coerce.number().optional(),
    sugars_100g: z.coerce.number().optional(),
    salt_100g: z.coerce.number().optional(),
  })
  .partial();

const productSchema = z.object({
  code: z.string().regex(/^\d{6,14}$/),
  product_name: z.string().optional(),
  product_name_fr: z.string().optional(),
  // Chaîne « Marque A, Marque B » sur l'API produit, liste sur le moteur de recherche.
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  nutriments: nutrimentsSchema.optional(),
  serving_quantity: z.coerce.number().optional(),
});
type OffProduct = z.infer<typeof productSchema>;

export type OffCandidate = {
  code: string;
  name: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarsG: number | null;
  saltG: number | null;
  servingGrams: number | null;
};

/** Produit exploitable (nom et valeurs pour 100 g), sinon null. */
export function toCandidate(product: OffProduct): OffCandidate | null {
  const name = (product.product_name_fr || product.product_name || "").trim();
  const n = product.nutriments ?? {};
  const protein = n.proteins_100g;
  const carbs = n.carbohydrates_100g;
  const fat = n.fat_100g;
  if (!name || protein === undefined || carbs === undefined || fat === undefined) return null;
  const kcal =
    n["energy-kcal_100g"] ??
    (n.energy_100g !== undefined ? n.energy_100g / 4.184 : kcalFromMacros(protein, carbs, fat));
  return {
    code: product.code,
    name,
    brand: (Array.isArray(product.brands) ? product.brands[0] : product.brands?.split(",")[0])?.trim() || null,
    kcal: round2(kcal),
    proteinG: round2(protein),
    carbsG: round2(carbs),
    fatG: round2(fat),
    fiberG: n.fiber_100g ?? null,
    sugarsG: n.sugars_100g ?? null,
    saltG: n.salt_100g ?? null,
    servingGrams: product.serving_quantity && product.serving_quantity > 0 ? product.serving_quantity : null,
  };
}

async function offFetch(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.warn(`[off] ${new URL(url).host} injoignable :`, error instanceof Error ? error.message : error);
    throw new DomainError("off_unavailable");
  }
  if (response.status === 404) throw new DomainError("not_found");
  if (!response.ok) {
    console.warn(`[off] ${new URL(url).host} a répondu ${response.status}`);
    throw new DomainError("off_unavailable");
  }
  return response.json();
}

function toCandidates(products: unknown[]): OffCandidate[] {
  return products
    .map((raw) => productSchema.safeParse(raw))
    .flatMap((parsed) => (parsed.success ? [toCandidate(parsed.data)] : []))
    .filter((candidate): candidate is OffCandidate => candidate !== null);
}

/** Moteur de recherche d'OFF, avec repli sur l'ancienne recherche s'il ne répond pas. */
export async function searchOpenFoodFacts(userId: string, query: string): Promise<OffCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await enforceRateLimit(`off:search:${userId}`, SEARCH_RULE);
  try {
    const params = new URLSearchParams({ q, langs: "fr", page_size: "20", fields: FIELDS });
    const body = z
      .object({ hits: z.array(z.unknown()).default([]) })
      .parse(await offFetch(`${OFF_SEARCH_BASE}/search?${params}`));
    return toCandidates(body.hits);
  } catch (error) {
    if (!(error instanceof DomainError || error instanceof z.ZodError)) throw error;
    const params = new URLSearchParams({
      search_terms: q,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "20",
      fields: FIELDS,
    });
    const body = z
      .object({ products: z.array(z.unknown()).default([]) })
      .parse(await offFetch(`${OFF_BASE}/cgi/search.pl?${params}`));
    return toCandidates(body.products);
  }
}

/** Récupère un produit par son code-barres et le met en cache. Renvoie l'id de l'aliment. */
export async function importOpenFoodFactsProduct(userId: string, code: string): Promise<string> {
  const barcode = z
    .string()
    .regex(/^\d{6,14}$/)
    .parse(code);
  await enforceRateLimit(`off:product:${userId}`, { window: 60, max: 30 });
  const body = z
    .object({ product: z.unknown().optional() })
    .parse(await offFetch(`${OFF_BASE}/api/v2/product/${barcode}.json?fields=${FIELDS}`));
  const parsed = productSchema.safeParse({ ...(body.product as object), code: barcode });
  const candidate = parsed.success ? toCandidate(parsed.data) : null;
  if (!candidate) throw new DomainError("off_incomplete");
  return cacheProduct(candidate);
}

export async function cacheProduct(candidate: OffCandidate): Promise<string> {
  const values = {
    nameFr: candidate.name,
    brand: candidate.brand,
    searchName: normalizeForSearch(`${candidate.name} ${candidate.brand ?? ""}`),
    kcal: candidate.kcal,
    proteinG: candidate.proteinG,
    carbsG: candidate.carbsG,
    fatG: candidate.fatG,
    fiberG: candidate.fiberG,
    sugarsG: candidate.sugarsG,
    saltG: candidate.saltG,
    unitWeights: candidate.servingGrams ? { portion: candidate.servingGrams } : null,
    fetchedAt: new Date(),
    updatedAt: new Date(),
  };
  const [row] = await db()
    .insert(foods)
    .values({ source: "off", sourceRef: candidate.code, ...values })
    .onConflictDoUpdate({ target: [foods.source, foods.sourceRef], set: values })
    .returning({ id: foods.id });
  return row!.id;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
