import type { CountUnit } from "../../src/domain/units";

/** Colonnes de `data/ciqual-2020.csv` (valeurs pour 100 g). */
export const CIQUAL_COLUMNS = [
  "code",
  "name_fr",
  "name_en",
  "group_fr",
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugars_g",
  "salt_g",
  "density_g_ml",
  "unit_weights",
] as const;

export function toCsvLine(values: readonly (string | number)[]): string {
  return values
    .map((value) => {
      const text = typeof value === "number" ? String(Math.round(value * 100) / 100) : value;
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    })
    .join(",");
}

/** Découpe une ligne CSV (guillemets doublés gérés). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      fields.push(current);
      current = "";
    } else current += char;
  }
  fields.push(current);
  return fields;
}

type Hints = { densityGPerMl?: number; unitWeights?: Partial<Record<CountUnit, number>> };

/**
 * Masses volumiques et poids unitaires usuels, choisis pour l'app (valeurs moyennes
 * arrondies) afin de proposer « 1 œuf » ou « 20 cl » plutôt que des grammes.
 * Le premier motif qui correspond au nom (en minuscules) l'emporte.
 */
const HINTS: [RegExp, Hints][] = [
  [/^huile/, { densityGPerMl: 0.92 }],
  [/^lait\b(?!.*(poudre|concentré))/, { densityGPerMl: 1.03 }],
  [/^(jus|nectar|boisson|soda|limonade|eau\b|thé|café|tisane|bière|vin\b|cidre)/, { densityGPerMl: 1 }],
  [/^crème.*(liquide|fluide|uht)/, { densityGPerMl: 1 }],
  [/^(soupe|potage|velouté|bouillon)/, { densityGPerMl: 1, unitWeights: { portion: 250 } }],
  [/^miel/, { densityGPerMl: 1.4 }],
  [/^(sucre blanc|sucre roux|cassonade)/, { densityGPerMl: 0.85 }],
  [/^farine/, { densityGPerMl: 0.55 }],
  [/^vinaigre/, { densityGPerMl: 1 }],
  [/^sauce/, { densityGPerMl: 1.05 }],
  [/^yaourt|^lait fermenté/, { unitWeights: { piece: 125 } }],
  [/^fromage blanc/, { unitWeights: { portion: 100 } }],
  [/^petit-suisse/, { unitWeights: { piece: 60 } }],
  // Œufs de poisson (lompe, saumon) : pas de pièce. Blanc et jaune pèsent une part de l'œuf.
  [/^(œufs?|oeufs?) de (lompe|cabillaud|saumon|truite|poisson)/, {}],
  [/^(œuf|oeuf), blanc/, { unitWeights: { piece: 33 } }],
  [/^(œuf|oeuf), jaune/, { unitWeights: { piece: 18 } }],
  [/^(œuf|oeuf) de caille/, { unitWeights: { piece: 10 } }],
  [/^(œuf|oeuf) de cane/, { unitWeights: { piece: 70 } }],
  [/^(œuf|oeuf) de dinde/, { unitWeights: { piece: 80 } }],
  [/^(œuf|oeuf) d'oie/, { unitWeights: { piece: 150 } }],
  [/^œuf|^oeuf/, { unitWeights: { piece: 55 } }],
  [/^pain de mie/, { unitWeights: { slice: 25 } }],
  [/^pain\b/, { unitWeights: { slice: 35 } }],
  [/^biscotte/, { unitWeights: { piece: 9 } }],
  [/^baguette/, { unitWeights: { piece: 250, slice: 35 } }],
  [/^croissant/, { unitWeights: { piece: 50 } }],
  [/^pain au chocolat/, { unitWeights: { piece: 65 } }],
  [/^jambon/, { unitWeights: { slice: 40 } }],
  [/^(emmental|comté|gouda|cheddar|edam)/, { unitWeights: { slice: 20, portion: 30 } }],
  [/^(camembert|brie|chèvre|roquefort|fromage)/, { unitWeights: { portion: 30 } }],
  [/^beurre/, { unitWeights: { portion: 10 } }],
  [/^pomme\b(?!.*de terre)/, { unitWeights: { piece: 150 } }],
  [/^poire\b/, { unitWeights: { piece: 160 } }],
  [/^banane plantain/, { unitWeights: { piece: 250 } }],
  [/^banane\b/, { unitWeights: { piece: 120 } }],
  [/^orange\b/, { unitWeights: { piece: 150 } }],
  [/^clémentine|^mandarine/, { unitWeights: { piece: 70 } }],
  [/^kiwi/, { unitWeights: { piece: 75 } }],
  [/^pêche|^nectarine/, { unitWeights: { piece: 130 } }],
  [/^abricot\b/, { unitWeights: { piece: 40 } }],
  [/^tomate cerise/, { unitWeights: { piece: 15 } }],
  [/^tomate (côtelée|coeur de boeuf|cœur de bœuf)/, { unitWeights: { piece: 250 } }],
  [/^tomate\b/, { unitWeights: { piece: 100 } }],
  [/^carotte\b/, { unitWeights: { piece: 80 } }],
  [/^pomme de terre/, { unitWeights: { piece: 120 } }],
  [/^avocat\b/, { unitWeights: { piece: 150 } }],
  [/^(riz|pâtes|semoule|quinoa|lentille|pois chiche|haricot)/, { unitWeights: { portion: 150 } }],
  [/^(poulet|dinde|boeuf|bœuf|porc|veau|agneau|saumon|cabillaud|thon|colin)/, { unitWeights: { portion: 120 } }],
  [/^(steak haché)/, { unitWeights: { piece: 100 } }],
  [/^(compote)/, { unitWeights: { piece: 100 } }],
  [/^(chocolat)/, { unitWeights: { piece: 5 } }],
  [/^(céréales|muesli|flocons d'avoine)/, { unitWeights: { portion: 40 } }],
  [/^(pizza|quiche|tarte)/, { unitWeights: { portion: 150 } }],
];

/** Groupe Ciqual 06 : boissons, toujours mesurables en volume. */
const BEVERAGE_GROUP = "06";

/** Formes transformées dont la « pièce » n'a plus le poids du produit frais (pomme sèche, frites…). */
const PROCESSED =
  /(sèche|séché|\bsec\b|déshydrat|appertis|au sirop|confit|en poudre|chips|frite|purée|flocons|noisette|dauphine|duchesse)/;

export function ciqualHints(name: string, groupCode: string): Hints {
  const lower = name.toLowerCase();
  let match = HINTS.find(([pattern]) => pattern.test(lower))?.[1] ?? {};
  if (match.unitWeights?.piece && PROCESSED.test(lower)) {
    const { piece: _piece, ...others } = match.unitWeights;
    match = { ...match, unitWeights: Object.keys(others).length > 0 ? others : undefined };
  }
  if (groupCode === BEVERAGE_GROUP && match.densityGPerMl === undefined) return { ...match, densityGPerMl: 1 };
  return match;
}
