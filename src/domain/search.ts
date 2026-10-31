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

/** Eau sans précision, ou un verre dont la boisson n'est pas nommée. */
const PLAIN_WATER = /^(?:(?:petit |grand )?verre(?: d eau)?|eau(?: plate| fraiche)?)$/;

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
  // Un café du quotidien est une boisson prête à boire, pas du café moulu ou en poudre
  // (60 fois plus calorique à poids égal), ni un café au lait.
  [/^(?:un |une )?(?:cafe )?(?:expresso|espresso|ristretto)$|^(?:un )?cafe serre$/, "cafe expresso non instantane"],
  [
    /^(?:un )?(?:cafe(?: (?:allonge|long|filtre|noir|nature|americain|sans sucre|non sucre))?|americano)$/,
    "cafe non instantane non sucre",
  ],
  // L'oignon vert (cébette) se dit « ciboule » dans Ciqual.
  [/\boignons? verts?\b/, "ciboule"],
  // Le blanc de volaille est le « filet » de Ciqual, un lait végétal une « boisson ».
  [/\bblanc de (poulet|dinde)\b/, "$1 filet"],
  [/\blait (?:d |de |a l )?(avoine|amande|soja|riz)\b/, "boisson $1"],
  // « Un verre » seul se cherche aussi comme de l'eau.
  [PLAIN_WATER, "eau du robinet"],
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

/** Petits mots qui ne disent rien de l'aliment : « jus d'orange » se cherche sur jus et orange. */
const STOPWORDS = new Set(["a", "au", "aux", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les", "un", "une"]);

/**
 * Débuts des mots qui désignent l'aliment, sans les petits mots ni les pluriels et coupés à six
 * lettres pour couvrir les accords : « haricots verts surgelés » → harico, vert, surgel. Six au plus.
 */
export function searchStems(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word).slice(0, 6))
    .slice(0, 6);
}

/**
 * « Pâte » désigne aussi ce qui n'est pas un féculent cuit : pâte à tartiner, pâte feuilletée,
 * pâte de fruits, et sans accents « pâté ». Ces noms ne sont ni des pâtes ni pesés cuits.
 */
const NOT_PASTA =
  /\bpates? (?:a (?:tartiner|pizza|crepes?|tarte|pain|modeler)|feuilletee|brisee|sablee|d amandes?|de (?:fruits?|coings?|campagne|foie|lapin|canard|porc)|en croute)\b/;
const STARCH =
  /\b(?:pates?|riz|semoule|couscous|quinoa|boulgour|lentilles?|nouilles?|polenta|pois chiches?|haricots? secs?)\b/;
const RAW = /\b(?:cru|crue|crus|crues)\b/;
const COOKED = /\bcuit/;

/** Féculent (pâtes, riz, légumineuses…) que l'on pèse d'ordinaire cuit, sauf « cru » explicite. */
export function isCookedStarchLabel(label: string): boolean {
  const normalized = normalizeForSearch(label);
  return isStarch(normalized) && !RAW.test(normalized);
}

function isStarch(normalized: string): boolean {
  return [normalized, ...searchVariants(normalized)].some((text) => STARCH.test(text.replace(NOT_PASTA, "")));
}

/**
 * Aliment à proposer pour un nom reconnu par l'IA. Une assiette se pèse cuite : pour des
 * pâtes, du riz ou des légumineuses (sauf « cru » explicite), ou tout nom dit « cuit »,
 * la version cuite passe avant un paquet sec, trois fois plus calorique à poids égal.
 */
export function pickForLabel<T extends { nameFr: string }>(label: string, results: readonly T[]): T | null {
  const normalized = normalizeForSearch(label);
  const starch = isStarch(normalized);
  // « Eau de vie » est plus court que « Eau du robinet » et sortirait en premier.
  if (PLAIN_WATER.test(normalized)) {
    const water = results.find((food) => normalizeForSearch(food.nameFr).startsWith("eau du robinet"));
    if (water) return water;
  }
  const wantsCooked = COOKED.test(normalized) || (starch && !RAW.test(normalized));
  if (wantsCooked) {
    // Pour un féculent, la version cuite doit en être un aussi : « linguine » ressemble à
    // « Julienne ou Lingue, cuite », un poisson.
    const cooked = results.find((food) => {
      const name = normalizeForSearch(food.nameFr);
      return COOKED.test(name) && !RAW.test(name) && (!starch || STARCH.test(name));
    });
    if (cooked) return cooked;
  }
  return results[0] ?? null;
}
