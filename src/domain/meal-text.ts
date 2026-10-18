/**
 * Saisie d'un repas en texte libre ou à la voix : découpage, quantités et règles apprises
 * des corrections (calcul pur, sans appel à l'IA).
 */
import { normalizeForSearch } from "./search";
import type { Unit } from "./units";

/** Découpe « 2 œufs brouillés et une tartine, un café » en morceaux. */
export function splitMealText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[,;+\n]|\s(?:et|and|puis|then)\s/)
    .map((part) => part.trim().replace(/^(?:et|and|puis|then)\s+/, ""))
    .filter(Boolean);
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  a: 1,
  an: 1,
  one: 1,
  deux: 2,
  two: 2,
  trois: 3,
  three: 3,
  quatre: 4,
  four: 4,
  cinq: 5,
  five: 5,
};

export type Segment = {
  /** Nombre devant le texte (« 2 tartines », « une pomme »), sinon null. */
  count: number | null;
  /** Poids donné explicitement (« 150 g de riz »), sinon null. */
  grams: number | null;
  /** Reste du texte, normalisé. */
  rest: string;
};

/** Sépare la quantité éventuelle (« 2 », « une », « 150 g de ») du reste d'un morceau. */
export function parseSegment(segment: string): Segment {
  const match = /^(\d+(?:[.,]\d+)?|[a-z]+)\s*(kg|g|gr|grammes?|grams?)?\s+(?:(?:de|d'|d’|of)\s*)?(.+)$/i.exec(
    segment.trim().toLowerCase(),
  );
  if (match) {
    const [, rawNumber = "", unit, rest = ""] = match;
    const number = /^\d/.test(rawNumber) ? Number(rawNumber.replace(",", ".")) : NUMBER_WORDS[rawNumber];
    if (number !== undefined && number > 0) {
      if (unit) return { count: null, grams: unit === "kg" ? number * 1000 : number, rest: normalizeForSearch(rest) };
      return { count: number, grams: null, rest: normalizeForSearch(rest) };
    }
  }
  return { count: null, grams: null, rest: normalizeForSearch(segment) };
}

/** Règle apprise : pour ce nom proposé par l'IA, l'utilisateur choisit cet aliment, à ce poids. */
export type CorrectionRule = { foodId: string; grams: number };

export type LocalItem = {
  foodId: string;
  quantity: number;
  unit: Unit;
  /** Morceau de texte d'origine, gardé pour l'écran de confirmation. */
  label: string;
  /** Nom de la règle appliquée. */
  ruleLabel: string;
};

/**
 * Résout un texte sans IA quand chaque morceau correspond à une règle apprise des
 * corrections. Renvoie null dès qu'un morceau reste inconnu.
 */
export function resolveLocally(text: string, rules: ReadonlyMap<string, CorrectionRule>): LocalItem[] | null {
  const parts = splitMealText(text);
  if (parts.length === 0) return null;
  const items: LocalItem[] = [];
  for (const part of parts) {
    const segment = parseSegment(part);
    const rule = rules.get(segment.rest);
    if (!rule) return null;
    const grams = segment.grams ?? rule.grams * (segment.count ?? 1);
    items.push({ foodId: rule.foodId, quantity: round2(grams), unit: "g", label: part, ruleLabel: segment.rest });
  }
  return items;
}

/**
 * Règles locales tirées des corrections : pour chaque nom proposé par l'IA, l'aliment
 * choisi au moins deux fois (le plus souvent s'il y en a plusieurs), au poids médian.
 */
export function correctionRules(
  corrections: readonly { aiLabel: string; foodId: string; grams: number }[],
): Map<string, CorrectionRule> {
  const groups = new Map<string, Map<string, number[]>>();
  for (const { aiLabel, foodId, grams } of corrections) {
    const byFood = groups.get(aiLabel) ?? new Map<string, number[]>();
    byFood.set(foodId, [...(byFood.get(foodId) ?? []), grams]);
    groups.set(aiLabel, byFood);
  }
  const rules = new Map<string, CorrectionRule>();
  for (const [label, byFood] of groups) {
    const [foodId, grams] = [...byFood].sort((a, b) => b[1].length - a[1].length)[0]!;
    if (grams.length >= 2) rules.set(label, { foodId, grams: Math.round(median(grams)) });
  }
  return rules;
}

/** Une proposition de l'IA a-t-elle été corrigée (autre aliment, ou poids changé de plus de 10 %) ? */
export function isCorrection(
  proposal: { foodId: string | null; grams: number },
  final: { foodId: string; grams: number },
): boolean {
  if (proposal.foodId !== final.foodId) return true;
  return Math.abs(final.grams - proposal.grams) > Math.max(proposal.grams * 0.1, 5);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
