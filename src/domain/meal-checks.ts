/**
 * Contrôle des aliments proposés par l'IA avant l'ajout au journal (calcul pur). Une erreur de
 * correspondance (un poisson pour des linguine, des pâtes sèches pour une assiette) ou un poids
 * démesuré fausse toute la journée : ces lignes sont signalées et doivent être relues.
 */
import { isCookedStarchLabel, normalizeForSearch, searchVariants } from "./search";

export type LineCheck = "unrelated" | "dry" | "heavy";

/** Un féculent cuit dépasse rarement 200 kcal pour 100 g ; sec, il en compte plus de 330. */
const DRY_STARCH_KCAL = 250;
/** Au-delà, une seule ligne pèse plus qu'une assiette bien remplie. */
const HEAVY_GRAMS = 600;
const HEAVY_KCAL = 800;

const STOPWORDS = new Set(["avec", "sans", "pour", "fait", "maison", "nature", "petit", "grand", "grande"]);

/** Racines des mots significatifs : « tomates cerises » → tomat, ceris. */
function stems(text: string): Set<string> {
  return new Set(
    text
      .split(" ")
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
      .map((word) => word.slice(0, 5)),
  );
}

/** Vrai quand le nom de l'aliment trouvé n'a aucun mot en commun avec ce que l'IA a reconnu. */
export function looksUnrelated(label: string, foodName: string): boolean {
  const normalized = normalizeForSearch(label);
  const wanted = stems([normalized, ...searchVariants(normalized)].join(" "));
  if (wanted.size === 0) return false;
  const found = stems(normalizeForSearch(foodName));
  return ![...wanted].some((stem) => found.has(stem));
}

export type CheckInput = {
  /** Ce que l'IA a reconnu. */
  label: string;
  /** Aliment retenu dans la base, ou null pour une estimation de l'IA. */
  food: { nameFr: string; kcal: number; source?: string } | null;
  /** Vrai quand l'aliment vient d'une habitude apprise ou d'un choix de l'utilisateur. */
  chosen: boolean;
  grams: number;
  kcal: number;
};

/** Points à relire pour une ligne, du plus grave au moins grave ; vide si rien ne cloche. */
export function checkLine(input: CheckInput): LineCheck[] {
  const checks: LineCheck[] = [];
  const { food } = input;
  if (food && !input.chosen && looksUnrelated(input.label, food.nameFr)) checks.push("unrelated");
  if (food && food.source !== "recipe" && isCookedStarchLabel(input.label) && food.kcal >= DRY_STARCH_KCAL) {
    checks.push("dry");
  }
  if (input.grams > HEAVY_GRAMS || input.kcal > HEAVY_KCAL) checks.push("heavy");
  return checks;
}
