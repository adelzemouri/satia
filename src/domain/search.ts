/**
 * Forme normalisée d'un nom pour la recherche : minuscules, sans accents ni ponctuation,
 * « œ » et « æ » développés. Stockée en base pour l'index trigramme.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mots du quotidien absents des noms Ciqual : « crème liquide » s'y dit « crème … fluide »,
 * « crème fraîche » « crème … épaisse ». Les règles portent sur le texte déjà normalisé,
 * de la plus précise à la plus générale.
 */
const SYNONYMS: readonly [RegExp, string][] = [
  [/\bcreme fraiche (?:liquide|fluide)\b/, "creme fluide"],
  [/\bcreme (?:liquide|cuisine|de cuisine)\b/, "creme fluide"],
  [/\bcreme fraiche\b/, "creme epaisse"],
  [/\bcreme entiere\b/, "creme 30"],
  [/\bcreme allegee\b/, "creme legere"],
  // Ciqual ne connaît pas les formes de pâtes : des linguine sont des « pâtes sèches ».
  [
    /\b(?:linguine|spaghetti|tagliatelle|penne|fusilli|macaroni|coquillette|farfalle|rigatoni|torsade|papillon)s?\b/,
    "pates seches",
  ],
];

/** Formulation Ciqual à chercher en plus (première règle qui s'applique), ou rien. */
export function searchVariants(normalized: string): string[] {
  const rule = SYNONYMS.find(([pattern]) => pattern.test(normalized));
  if (!rule) return [];
  const variant = normalized.replace(rule[0], rule[1]);
  return variant === normalized ? [] : [variant];
}

const STARCH =
  /\b(?:pates?|riz|semoule|couscous|quinoa|boulgour|lentilles?|nouilles?|polenta|pois chiches?|haricots? secs?)\b/;
const RAW = /\b(?:cru|crue|crus|crues)\b/;
const COOKED = /\bcuit/;

/**
 * Aliment à proposer pour un nom reconnu par l'IA. Une assiette se pèse cuite : pour des
 * pâtes, du riz ou des légumineuses (sauf « cru » explicite), ou tout nom dit « cuit »,
 * la version cuite passe avant un paquet sec, trois fois plus calorique à poids égal.
 */
export function pickForLabel<T extends { nameFr: string }>(label: string, results: readonly T[]): T | null {
  const normalized = normalizeForSearch(label);
  const starch = [normalized, ...searchVariants(normalized)].some((text) => STARCH.test(text));
  const wantsCooked = COOKED.test(normalized) || (starch && !RAW.test(normalized));
  if (wantsCooked) {
    const cooked = results.find((food) => {
      const name = normalizeForSearch(food.nameFr);
      return COOKED.test(name) && !RAW.test(name);
    });
    if (cooked) return cooked;
  }
  return results[0] ?? null;
}
