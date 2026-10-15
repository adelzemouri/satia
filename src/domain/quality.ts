/**
 * Qualité nutritionnelle (calcul pur) : repères indicatifs du jour et bilan de la semaine.
 * Repères : 30 g de fibres par jour (ANSES), 5 portions de 80 g de fruits et légumes (PNNS),
 * 5 g de sel par jour (OMS).
 */
export const NUTRISCORE_GRADES = ["a", "b", "c", "d", "e"] as const;
export type NutriscoreGrade = (typeof NUTRISCORE_GRADES)[number];

export const FIBER_GOAL_G = 30;
export const FRUIT_VEG_PORTION_G = 80;
export const FRUIT_VEG_GOAL_PORTIONS = 5;
export const SALT_REFERENCE_G = 5;

/** Groupes Ciqual comptés comme fruits et légumes (les fruits à coque et les jus n'en font pas partie). */
const FRUIT_VEG_GROUPS = new Set(["fruits", "légumes"]);

export function fruitVegShareForGroup(groupFr: string | null): number {
  return groupFr !== null && FRUIT_VEG_GROUPS.has(groupFr) ? 1 : 0;
}

/** Catégories Open Food Facts de fruits et légumes, hors boissons et produits sucrés. */
const OFF_FRUIT_VEG = [
  "en:fresh-fruits",
  "en:fresh-vegetables",
  "en:frozen-vegetables",
  "en:frozen-fruits",
  "en:canned-vegetables",
];
const OFF_EXCLUDED = ["en:beverages", "en:jams", "en:fruit-juices", "en:sweet-snacks", "en:compotes"];

export function fruitVegShareForCategories(tags: readonly string[]): number {
  if (tags.some((tag) => OFF_EXCLUDED.includes(tag))) return 0;
  return tags.some((tag) => OFF_FRUIT_VEG.includes(tag)) ? 1 : 0;
}

export function toNutriscore(raw: string | undefined): NutriscoreGrade | null {
  const grade = raw?.toLowerCase();
  return NUTRISCORE_GRADES.find((value) => value === grade) ?? null;
}

export function toNovaGroup(raw: number | undefined): number | null {
  return raw !== undefined && Number.isInteger(raw) && raw >= 1 && raw <= 4 ? raw : null;
}

/** Une ligne de journal avec les valeurs de qualité de son aliment (pour 100 g). */
export type QualityItem = {
  date: string;
  name: string;
  grams: number;
  kcal: number;
  fiberG: number | null;
  sugarsG: number | null;
  saltG: number | null;
  novaGroup: number | null;
  fruitVegShare: number;
};

export type DayQuality = { fiberG: number; fruitVegPortions: number; saltG: number; sugarsG: number };

export function dayQuality(items: readonly QualityItem[]): DayQuality {
  const total = (pick: (item: QualityItem) => number | null) =>
    round1(items.reduce((sum, item) => sum + ((pick(item) ?? 0) * item.grams) / 100, 0));
  return {
    fiberG: total((item) => item.fiberG),
    fruitVegPortions: round1(fruitVegGrams(items) / FRUIT_VEG_PORTION_G),
    saltG: total((item) => item.saltG),
    sugarsG: total((item) => item.sugarsG),
  };
}

/**
 * Équilibre du jour sur 100, à titre indicatif : il se remplit au fil des repas avec les fibres
 * (40 %) et les fruits et légumes (40 %) ; le sel (20 %) reste plein jusqu'au repère de 5 g puis
 * baisse doucement. Aucun aliment n'est « interdit » : on regarde ce qu'on ajoute.
 */
export function dayBalanceScore(quality: DayQuality): number {
  const fiber = Math.min(1, quality.fiberG / FIBER_GOAL_G);
  const fruitVeg = Math.min(1, quality.fruitVegPortions / FRUIT_VEG_GOAL_PORTIONS);
  const salt =
    quality.saltG <= SALT_REFERENCE_G ? 1 : Math.max(0, 1 - (quality.saltG - SALT_REFERENCE_G) / SALT_REFERENCE_G);
  return Math.round(100 * (0.4 * fiber + 0.4 * fruitVeg + 0.2 * salt));
}

function fruitVegGrams(items: readonly QualityItem[]): number {
  return items.reduce((sum, item) => sum + item.grams * item.fruitVegShare, 0);
}

export type Suggestion = "fiber" | "fruitVeg" | "homemade" | "salt" | "keepGoing";

export type WeekQuality = {
  daysLogged: number;
  /** Part des calories venant d'aliments ultra-transformés (NOVA 4), parmi celles dont le groupe est connu. */
  ultraProcessedShare: number | null;
  /** Part des calories dont le groupe NOVA est connu. */
  novaCoverage: number;
  fiberPerDay: number;
  saltPerDay: number;
  sugarsPerDay: number;
  fruitVegPortionsPerDay: number;
  /** Aliments qui apportent le plus de sel, et ultra-transformés qui apportent le plus de calories. */
  topSalt: string[];
  topUltraProcessed: string[];
  /** Une ou deux idées, formulées en « ajouter » plutôt qu'en « retirer ». */
  suggestions: Suggestion[];
};

/** Bilan qualité d'une période ; les moyennes portent sur les jours saisis. */
export function weekQuality(items: readonly QualityItem[]): WeekQuality | null {
  const days = new Set(items.map((item) => item.date)).size;
  if (days === 0) return null;
  const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
  const known = items.filter((item) => item.novaGroup !== null);
  const knownKcal = known.reduce((sum, item) => sum + item.kcal, 0);
  const upf = known.filter((item) => item.novaGroup === 4);
  const upfKcal = upf.reduce((sum, item) => sum + item.kcal, 0);
  const perDay = (pick: (item: QualityItem) => number | null) =>
    round1(items.reduce((sum, item) => sum + ((pick(item) ?? 0) * item.grams) / 100, 0) / days);

  const result: Omit<WeekQuality, "suggestions"> = {
    daysLogged: days,
    ultraProcessedShare: knownKcal > 0 ? round2(upfKcal / knownKcal) : null,
    novaCoverage: totalKcal > 0 ? round2(knownKcal / totalKcal) : 0,
    fiberPerDay: perDay((item) => item.fiberG),
    saltPerDay: perDay((item) => item.saltG),
    sugarsPerDay: perDay((item) => item.sugarsG),
    fruitVegPortionsPerDay: round1(fruitVegGrams(items) / FRUIT_VEG_PORTION_G / days),
    topSalt: topBy(items, (item) => ((item.saltG ?? 0) * item.grams) / 100),
    topUltraProcessed: topBy(upf, (item) => item.kcal),
  };
  return { ...result, suggestions: suggestionsFor(result) };
}

function suggestionsFor(week: Omit<WeekQuality, "suggestions">): Suggestion[] {
  const list: Suggestion[] = [];
  if (week.fruitVegPortionsPerDay < FRUIT_VEG_GOAL_PORTIONS - 1) list.push("fruitVeg");
  if (week.fiberPerDay < FIBER_GOAL_G - 5) list.push("fiber");
  if (week.ultraProcessedShare !== null && week.novaCoverage >= 0.3 && week.ultraProcessedShare > 0.3) {
    list.push("homemade");
  }
  if (week.saltPerDay > SALT_REFERENCE_G + 1) list.push("salt");
  return list.length > 0 ? list.slice(0, 2) : ["keepGoing"];
}

/** Les 3 aliments (par nom) qui pèsent le plus selon `weight`. */
function topBy(items: readonly QualityItem[], weight: (item: QualityItem) => number): string[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.name, (totals.get(item.name) ?? 0) + weight(item));
  return [...totals]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

/**
 * Valeurs de qualité d'une recette pour 100 g : fibres, sucres et sel connus seulement si
 * tous les ingrédients les connaissent ; part de fruits et légumes rapportée au poids cru.
 */
export function recipeQuality(
  ingredients: readonly {
    grams: number;
    fiberG: number | null;
    sugarsG: number | null;
    saltG: number | null;
    fruitVegShare: number;
  }[],
  totalGrams: number,
): { fiberG: number | null; sugarsG: number | null; saltG: number | null; fruitVegShare: number } {
  const rawGrams = ingredients.reduce((sum, item) => sum + item.grams, 0);
  const per100 = (pick: (item: (typeof ingredients)[number]) => number | null) =>
    ingredients.every((item) => pick(item) !== null)
      ? round2(ingredients.reduce((sum, item) => sum + (pick(item)! * item.grams) / 100, 0) * (100 / totalGrams))
      : null;
  return {
    fiberG: per100((item) => item.fiberG),
    sugarsG: per100((item) => item.sugarsG),
    saltG: per100((item) => item.saltG),
    fruitVegShare:
      rawGrams > 0 ? round2(ingredients.reduce((sum, item) => sum + item.grams * item.fruitVegShare, 0) / rawGrams) : 0,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Marqueurs NOVA d'Open Food Facts : pour chaque groupe, des paires [type, étiquette]. */
export type NovaGroupsMarkers = Partial<Record<string, readonly (readonly string[])[]>>;

/** Étiquettes qui placent le produit en NOVA 4 (ingrédients, additifs, catégories), sans doublon. */
export function novaFourMarkers(markers: NovaGroupsMarkers | undefined): string[] {
  const tags = (markers?.["4"] ?? []).map((pair) => pair[1]).filter((tag): tag is string => Boolean(tag));
  return [...new Set(tags)].slice(0, 8);
}

/** Clé de traduction d'un marqueur (« en:natural-flavouring » → « natural-flavouring »), ou un additif. */
export function novaMarkerKey(tag: string): { additive: string } | { key: string } {
  const bare = tag.replace(/^[a-z]{2}:/, "");
  const additive = /^e(\d{3,4}[a-z]?)$/i.exec(bare);
  return additive ? { additive: `E${additive[1]!.toLowerCase()}` } : { key: bare };
}

/**
 * Phrase sous les badges quand ils semblent se contredire : bonne composition mais
 * ultra-transformé, ou peu transformé mais composition riche.
 */
export function qualityVerdict(
  nutriscore: NutriscoreGrade | null,
  novaGroup: number | null,
): "goodButProcessed" | "simpleButRich" | null {
  if (!nutriscore || !novaGroup) return null;
  if ((nutriscore === "a" || nutriscore === "b") && novaGroup === 4) return "goodButProcessed";
  if ((nutriscore === "d" || nutriscore === "e") && novaGroup <= 2) return "simpleButRich";
  return null;
}

/**
 * Niveaux pour 100 g, à titre indicatif : fibres selon les allégations européennes (source dès
 * 3 g, riche dès 6 g) ; sucres et sel selon les seuils « faible / élevé » de l'étiquetage
 * britannique (sucres 5 et 22,5 g, sel 0,3 et 1,5 g).
 */
export function fiberLevel(grams: number): "rich" | "source" | "low" {
  return grams >= 6 ? "rich" : grams >= 3 ? "source" : "low";
}

export function sugarsLevel(grams: number): "low" | "medium" | "high" {
  return grams <= 5 ? "low" : grams > 22.5 ? "high" : "medium";
}

export function saltLevel(grams: number): "low" | "medium" | "high" {
  return grams <= 0.3 ? "low" : grams > 1.5 ? "high" : "medium";
}
