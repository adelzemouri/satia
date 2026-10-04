/** Nom proposé pour enregistrer un repas : ses deux premiers aliments, puis « +N ». */
export function suggestedMealName(labels: string[], max = 60): string {
  const names = labels.map((label) => label.trim()).filter(Boolean);
  if (names.length === 0) return "";
  const head = names.slice(0, 2).join(", ");
  const rest = names.length - 2;
  const name = rest > 0 ? `${head} +${rest}` : head;
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

/** Total des calories d'un repas enregistré, arrondi. */
export function savedMealKcal(items: { kcal: number }[]): number {
  return Math.round(items.reduce((total, item) => total + item.kcal, 0));
}
