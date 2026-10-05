/**
 * Questions toutes prêtes pour lancer la conversation avec le coach. Le texte vit dans les
 * traductions (`coach.questions.<clé>`) ; seule la clé circule dans l'adresse de la page.
 */
export const COACH_QUESTIONS = [
  "breakfastIdea",
  "lunchBox",
  "snackIdea",
  "sweetTooth",
  "dinnerIdea",
  "moreProtein",
  "moreFiber",
  "eatingOut",
  "weekSoFar",
  "hydration",
] as const;
export type CoachQuestion = (typeof COACH_QUESTIONS)[number];

export function isCoachQuestion(value: unknown): value is CoachQuestion {
  return typeof value === "string" && (COACH_QUESTIONS as readonly string[]).includes(value);
}

/** La question qui colle au moment de la journée. */
function questionOfTheMoment(hour: number): CoachQuestion {
  if (hour < 10) return "breakfastIdea";
  if (hour < 14) return "lunchBox";
  if (hour < 18) return "snackIdea";
  return "dinnerIdea";
}

function hash(text: string): number {
  return [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7);
}

/**
 * Trois questions pour l'accueil : celle du moment, puis deux autres qui changent d'un jour
 * à l'autre (même graine, même choix : la carte ne bouge pas à chaque visite).
 */
export function suggestedQuestions(hour: number, seed: string, count = 3): CoachQuestion[] {
  const first = questionOfTheMoment(hour);
  const timed: readonly CoachQuestion[] = ["breakfastIdea", "lunchBox", "snackIdea", "dinnerIdea"];
  const others = COACH_QUESTIONS.filter((question) => !timed.includes(question));
  const start = hash(seed) % others.length;
  const rotated = [...others.slice(start), ...others.slice(0, start)];
  return [first, ...rotated].slice(0, count);
}
