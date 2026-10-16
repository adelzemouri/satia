/** Regroupe des lignes de repas par plat, dans l'ordre de première apparition (calcul pur). */
export function groupByDish<T extends { dish?: string | null }>(
  items: readonly T[],
): { dish: string | null; items: T[] }[] {
  const groups = new Map<string, { dish: string | null; items: T[] }>();
  for (const item of items) {
    const dish = item.dish?.trim() || null;
    // Un aliment sans plat reste seul ; les plats sont comparés sans tenir compte de la casse.
    const key = dish === null ? `\u0000${groups.size}` : dish.toLowerCase();
    const group = groups.get(key) ?? { dish, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Longueur maximale d'un nom de plat, comme à l'enregistrement du repas. */
export const DISH_MAX_LENGTH = 60;

/** Mots d'un nom d'aliment qui ne désignent pas l'aliment lui-même (cuisson, liaisons). */
const NOT_A_FOOD =
  /^(?:cru|cuit|sec|seche|frit|grille|roti|poele|bouilli|saute|vapeur|four|nature|maison|avec|sans|pour|aux|des|les|une|morceau|morceaux|tranche|tranches|filet|escalope)s?$/;

/** Minuscules sans accents, pour comparer des mots écrits différemment. */
function fold(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/(?<=..)[sx]$/, "");
}

function foodWords(name: string): string[] {
  return (name.match(/[\p{L}']+/gu) ?? [])
    .map((word) => fold(word.replace(/^[ldLD]'/, "")))
    .filter((word) => word.length >= 3 && !NOT_A_FOOD.test(word));
}

/** Nom de tête d'un aliment de la base : « Veau, rôti, cuit » → « veau ». */
function headName(name: string): string {
  const head = name
    .split(",")[0]!
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  // « Riz blanc » → « riz blanc », mais un sigle (« IGP ») garde ses majuscules.
  return head.replace(/^\p{Lu}(?=\p{Ll})/u, (letter) => letter.toLowerCase());
}

/**
 * Nom du plat après le remplacement d'un de ses aliments : si l'ancien aliment est nommé dans
 * le plat (« Riz sauté au porc »), il cède la place au nouveau (« Riz sauté au veau »). Renvoie
 * le nom inchangé quand l'aliment remplacé n'y figure pas (calcul pur).
 */
export function dishAfterSwap(dish: string, oldNames: readonly string[], newName: string): string {
  const replacement = headName(newName);
  const kept = new Set(foodWords(replacement));
  const old = new Set(oldNames.flatMap(foodWords).filter((word) => !kept.has(word)));
  if (old.size === 0 || replacement.length === 0) return dish;
  let done = false;
  const renamed = dish.replace(/[\p{L}']+/gu, (word) => {
    const elided = /^[ldLD]'/.test(word) ? word.slice(0, 2) : "";
    const bare = word.slice(elided.length);
    if (done || !old.has(fold(bare))) return word;
    // « à l'agneau » ne devient pas « à l'dinde » : sans voyelle, on laisse le nom tel quel.
    if (elided && !/^[aeiouyhâéèêîôû]/i.test(replacement)) return word;
    done = true;
    const capital = !elided && /^\p{Lu}/u.test(bare);
    return elided + (capital ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement);
  });
  return done && renamed.length <= DISH_MAX_LENGTH ? renamed : dish;
}
