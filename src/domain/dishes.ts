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
