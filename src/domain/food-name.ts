/**
 * Nom court d'affichage d'un aliment. Les noms Ciqual sont précis mais longs (« Saumon, cuit,
 * sans précision (aliment moyen) ») : on retire les précisions techniques et on garde le début.
 * Le nom complet reste sur la fiche de l'aliment. Un nom saisi par la famille ne change pas,
 * sauf s'il contient ces mêmes précisions ou dépasse la longueur visée.
 */
const NOISE = [
  /^sans précision/i,
  /aliment moyen/i,
  /^pr[ée]-?emball[ée]e?s?$/i,
  /\d+(?:[.,]\d+)? ?% ?(?:de )?MG/i,
  /^environ$/i,
  /^enrichie?s? en /i,
  /^appertis[ée]e?s?$/i,
  /^[ée]goutt[ée]e?s?$/i,
  /^embouteill[ée]e?s?$/i,
  /^pr[ée]lev[ée]e?s? /i,
  /^(?:ex|type) ?:/i,
  /^(?:faiblement|moyennement|fortement) min[ée]ralis[ée]e?s?$/i,
  /^rayon /i,
  /^pulpe$/i,
  /^standard$/i,
  /^non sal[ée]e?s?$/i,
  /^(?:non )?(?:gazeuse|plate)$/i,
];

const COOKING_STATE =
  /^(?:cru|cuit|sec|sèche|séché|frit|grillé|rôti|poêlé|bouilli|réhydraté|déshydraté|à la vapeur)e?s?\b/i;

/** Une parenthèse technique : précision Ciqual ou nom latin (« Ascophyllum nodosum »). */
function isNoiseParenthesis(content: string): boolean {
  return (
    /^[A-Z][a-z]+ [a-z]+$/.test(content) ||
    NOISE.some((pattern) => pattern.test(content)) ||
    /^ex ?:|^sans précision/i.test(content)
  );
}

/** Au-delà de cette longueur, on ne garde que les premiers segments, dans `SHORT_NAME_LENGTH` caractères. */
const MAX_FULL_LENGTH = 48;
export const SHORT_NAME_LENGTH = 34;

export function shortFoodName(name: string): string {
  const withoutNoise = name
    .replace(/\s*\(([^()]*)\)/g, (match, content: string, offset: number, whole: string) => {
      // Une parenthèse finale est souvent une marque (« Yaourt (Danone) ») : on la garde si elle n'est pas technique.
      const atEnd = offset + match.length === whole.length;
      return isNoiseParenthesis(content.trim()) || !atEnd ? "" : match;
    })
    .trim();
  const segments = withoutNoise
    .split(/\s*,\s*/)
    .map((segment) => segment.trim())
    // Le premier segment est le nom de l'aliment : on n'en retire que le taux de matière grasse.
    .map((segment, index) =>
      index === 0 ? segment.replace(/\s*(?:à )?\d+(?:[.,]\d+)? ?% ?(?:de )?MG\b/i, "") : segment,
    )
    .filter((segment, index) => segment.length > 0 && (index === 0 || !NOISE.some((pattern) => pattern.test(segment))))
    // « rôti/cuit au four » → « rôti ».
    .map((segment, index) => (index > 0 ? segment.split("/")[0]!.trim() : segment));
  if (segments.length === 0) return name;
  const full = segments.join(", ");
  if (full.length <= MAX_FULL_LENGTH) return full;
  const kept = [segments[0]!];
  for (const segment of segments.slice(1)) {
    if (kept.join(", ").length + 2 + segment.length > SHORT_NAME_LENGTH) break;
    kept.push(segment);
  }
  // Cru, cuit ou sec change tout pour les valeurs : cette précision reste, même au-delà de la longueur.
  const state = segments.find((segment) => COOKING_STATE.test(segment));
  if (state && !kept.includes(state)) kept.push(state);
  const short = kept.join(", ");
  return short;
}

/** Taille d'une page de la liste « Récents » ; « Voir plus » charge la suivante. */
export const RECENT_PAGE = 15;
