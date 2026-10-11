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

export type MacroSplit = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Part des calories apportée par chaque macro, en % entiers dont la somme fait 100 (0 partout si vide). */
  percent: { protein: number; carbs: number; fat: number };
};

/** Grammes de chaque macro d'un repas et leur part dans ses calories (4/4/9 kcal par gramme). */
export function macroSplit(items: { proteinG: number; carbsG: number; fatG: number }[]): MacroSplit {
  const sum = (pick: (item: (typeof items)[number]) => number) => items.reduce((total, item) => total + pick(item), 0);
  const grams = {
    protein: sum((item) => item.proteinG),
    carbs: sum((item) => item.carbsG),
    fat: sum((item) => item.fatG),
  };
  const kcal = { protein: grams.protein * 4, carbs: grams.carbs * 4, fat: grams.fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  const keys = ["protein", "carbs", "fat"] as const;
  const percent = { protein: 0, carbs: 0, fat: 0 };
  if (total > 0) {
    // Plus forts restes : les pourcentages arrondis font toujours 100.
    const exact = keys.map((key) => ({ key, value: (kcal[key] / total) * 100 }));
    for (const { key, value } of exact) percent[key] = Math.floor(value);
    let missing = 100 - keys.reduce((acc, key) => acc + percent[key], 0);
    for (const { key } of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1))) {
      if (missing-- <= 0) break;
      percent[key] += 1;
    }
  }
  return { proteinG: Math.round(grams.protein), carbsG: Math.round(grams.carbs), fatG: Math.round(grams.fat), percent };
}
