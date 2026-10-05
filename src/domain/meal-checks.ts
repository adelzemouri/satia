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

/** Mots qui précisent sans désigner l'aliment : leur absence dans le nom trouvé ne compte pas. */
const STOPWORDS = new Set([
  "avec",
  "sans",
  "pour",
  "fait",
  "maison",
  "nature",
  "petit",
  "petite",
  "grand",
  "grande",
  "entier",
  "entiere",
  "frais",
  "fraiche",
  "cuit",
  "cuite",
  "cuits",
  "cuites",
  "tranche",
  "tranches",
  "morceau",
  "morceaux",
  "portion",
]);

/** Racines des mots significatifs : « tomates cerises » → tomat, ceris. */
function stems(text: string): string[] {
  return text
    .split(" ")
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
    .map((word) => word.slice(0, 5));
}

/**
 * Vrai quand le nom de l'aliment trouvé laisse de côté un mot de ce que l'IA a reconnu :
 * « coulis de tomate » ne doit pas devenir un coulis de fruits rouges. Une formulation Ciqual
 * (« linguine » → « pâtes sèches ») compte comme le nom reconnu.
 */
export function looksUnrelated(label: string, foodName: string): boolean {
  const normalized = normalizeForSearch(label);
  const found = new Set(stems(normalizeForSearch(foodName)));
  const forms = [normalized, ...searchVariants(normalized)].map(stems).filter((list) => list.length > 0);
  if (forms.length === 0) return false;
  return !forms.some((list) => list.every((stem) => found.has(stem)));
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
