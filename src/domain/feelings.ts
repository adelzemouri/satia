/** Historique du ressenti (faim, énergie, humeur notées de 1 à 5) et des calories par jour. */

export const FEELINGS_QUESTIONS = ["hunger", "energy", "mood"] as const;
export type FeelingQuestion = (typeof FEELINGS_QUESTIONS)[number];

export type FeelingDay = {
  date: string;
  hunger: number | null;
  energy: number | null;
  mood: number | null;
  /** Calories saisies ce jour-là ; null si rien n'a été noté. */
  kcal: number | null;
};

/** Une ligne par jour, du plus ancien au plus récent, y compris les jours sans donnée. */
export function feelingDays(
  dates: readonly string[],
  checkins: readonly { date: string; hunger: number | null; energy: number | null; mood: number | null }[],
  intakes: readonly { date: string; kcal: number }[],
): FeelingDay[] {
  const byDate = new Map(checkins.map((row) => [row.date, row]));
  const kcalByDate = new Map(intakes.map((row) => [row.date, row.kcal]));
  return dates.map((date) => {
    const checkin = byDate.get(date);
    const kcal = kcalByDate.get(date);
    return {
      date,
      hunger: checkin?.hunger ?? null,
      energy: checkin?.energy ?? null,
      mood: checkin?.mood ?? null,
      kcal: kcal === undefined ? null : Math.round(kcal),
    };
  });
}

/** Moyenne d'une question sur la période (une décimale), null si jamais notée. */
export function feelingAverage(days: readonly FeelingDay[], question: FeelingQuestion): number | null {
  const values = days.flatMap((day) => (day[question] === null ? [] : [day[question]]));
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}
