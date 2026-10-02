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
