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

type ScalableItem = {
  quantity: number;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Ligne d'un repas enregistré à une autre quantité (dans son unité) : poids et valeurs suivent. */
export function scaleSavedItem<T extends ScalableItem>(item: T, quantity: number): T {
  const factor = item.quantity > 0 ? quantity / item.quantity : 1;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    ...item,
    quantity,
    grams: round(item.grams * factor),
    kcal: round(item.kcal * factor),
    proteinG: round(item.proteinG * factor),
    carbsG: round(item.carbsG * factor),
    fatG: round(item.fatG * factor),
  };
}
