import { addDays } from "./energy";
import { isoWeekStart } from "./streak";

/** Historique long du coach : tout ce qu'on sait d'une personne, résumé par semaine puis par mois. */
export type LongHistoryInput = {
  today: string;
  /** Totaux de chaque jour saisi. */
  days: readonly { date: string; kcal: number; proteinG: number }[];
  weights: readonly { date: string; weightKg: number }[];
  checkins: readonly { date: string; hunger: number | null; energy: number | null; mood: number | null }[];
  /** Séances et activités libres. */
  moves: readonly { date: string; minutes: number }[];
  steps: readonly { date: string; steps: number }[];
};

/** Semaines détaillées une par une ; avant, les mois. */
export const DETAILED_WEEKS = 8;

type Period = { label: string; from: string; to: string };

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function within<T extends { date: string }>(rows: readonly T[], period: Period): T[] {
  return rows.filter((row) => row.date >= period.from && row.date <= period.to);
}

function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

/** Une période en une ligne courte ; null si rien n'y est saisi. */
function periodLine(input: LongHistoryInput, period: Period): string | null {
  const days = within(input.days, period);
  const weights = within(input.weights, period);
  const checkins = within(input.checkins, period);
  const moves = within(input.moves, period);
  const steps = within(input.steps, period);
  if (days.length + weights.length + checkins.length + moves.length + steps.length === 0) return null;

  const parts: string[] = [];
  if (days.length > 0) {
    parts.push(`${days.length} j saisi${days.length > 1 ? "s" : ""}`);
    parts.push(`${Math.round(average(days.map((day) => day.kcal))!)} kcal par jour`);
    parts.push(`${Math.round(average(days.map((day) => day.proteinG))!)} g prot./j`);
  }
  if (weights.length > 0) parts.push(`poids ${oneDecimal(average(weights.map((row) => row.weightKg))!)} kg`);
  for (const key of ["hunger", "energy", "mood"] as const) {
    const value = average(checkins.flatMap((row) => (row[key] === null ? [] : [row[key]])));
    if (value !== null)
      parts.push(`${{ hunger: "faim", energy: "énergie", mood: "humeur" }[key]} ${oneDecimal(value)}/5`);
  }
  if (moves.length > 0) {
    parts.push(
      `${moves.length} activité${moves.length > 1 ? "s" : ""} (${moves.reduce((sum, row) => sum + row.minutes, 0)} min)`,
    );
  }
  const stepsAverage = average(steps.map((row) => row.steps));
  if (stepsAverage !== null) parts.push(`${Math.round(stepsAverage)} pas/j`);
  return `${period.label} : ${parts.join(", ")}`;
}

function firstDate(input: LongHistoryInput): string | null {
  const dates = [input.days, input.weights, input.checkins, input.moves, input.steps].flatMap((rows) =>
    rows.map((row) => row.date),
  );
  return dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : null;
}

/**
 * Lignes d'historique long pour le coach : depuis quand la personne suit, l'évolution du poids,
 * puis une ligne par semaine (les 8 dernières) et une par mois avant. Chaque ligne donne les
 * moyennes des jours saisis : quelques centaines de tokens pour une année entière.
 */
export function longHistoryLines(input: LongHistoryInput): string[] {
  const start = firstDate(input);
  if (!start) return [];
  const lines = [`Suivi depuis le ${start} : ${input.days.length} jours de repas saisis.`];

  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length > 0) {
    const first = weights[0]!;
    const last = weights.at(-1)!;
    const lowest = weights.reduce((min, row) => (row.weightKg < min.weightKg ? row : min));
    lines.push(
      `Poids : ${oneDecimal(first.weightKg)} kg le ${first.date}, plus bas ${oneDecimal(lowest.weightKg)} kg le ${lowest.date}, dernier ${oneDecimal(last.weightKg)} kg le ${last.date}.`,
    );
  }

  const thisWeek = isoWeekStart(input.today);
  const weeks: Period[] = [];
  for (let index = DETAILED_WEEKS - 1; index >= 0; index--) {
    const from = addDays(thisWeek, -7 * index);
    if (addDays(from, 6) < start) continue;
    weeks.push({ label: index === 0 ? "Cette semaine" : `Sem. du ${from.slice(5)}`, from, to: addDays(from, 6) });
  }
  const detailedFrom = addDays(thisWeek, -7 * (DETAILED_WEEKS - 1));

  // Les mois entièrement ou partiellement avant les semaines détaillées.
  const months: Period[] = [];
  for (let month = start.slice(0, 7); `${month}-01` < detailedFrom;) {
    const [year, monthIndex] = month.split("-").map(Number) as [number, number];
    const next = monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const to = addDays(`${next}-01`, -1);
    months.push({
      label: `Mois ${month}`,
      from: `${month}-01`,
      to: to < detailedFrom ? to : addDays(detailedFrom, -1),
    });
    month = next;
  }

  const monthLines = months.flatMap((period) => periodLine(input, period) ?? []);
  if (monthLines.length > 0)
    lines.push(`Par mois (moyennes par jour saisi, pas des totaux) : ${monthLines.join(" ; ")}.`);
  const weekLines = weeks.flatMap((period) => periodLine(input, period) ?? []);
  if (weekLines.length > 0)
    lines.push(`Par semaine (moyennes par jour saisi, pas des totaux) : ${weekLines.join(" ; ")}.`);
  return lines;
}
