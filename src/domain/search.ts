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
];

/** Formulation Ciqual à chercher en plus (première règle qui s'applique), ou rien. */
export function searchVariants(normalized: string): string[] {
  const rule = SYNONYMS.find(([pattern]) => pattern.test(normalized));
  if (!rule) return [];
  const variant = normalized.replace(rule[0], rule[1]);
  return variant === normalized ? [] : [variant];
}
