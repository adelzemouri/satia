/**
 * Budget hebdomadaire (calcul pur) : la semaine (lundi → dimanche) dispose de 7 × l'objectif
 * quotidien. Chaque jour, ce qui reste est réparti sur les jours restants, avec un peu plus
 * pour les jours marqués « plus larges ».
 */
import { addDays } from "./energy";
import { isoWeekStart } from "./streak";

/** Un jour plus large compte pour 1,3 jour normal dans la répartition. */
export const LARGER_DAY_WEIGHT = 1.3;
/** Un jour ne descend jamais sous 80 % de l'objectif moyen (ni sous le plancher). */
export const MIN_DAY_SHARE = 0.8;
/** Plafonds pour éviter qu'un début de semaine léger ne crée des journées démesurées. */
export const MAX_DAY_SHARE = 1.2;
export const MAX_LARGER_DAY_SHARE = 1.5;

export type WeekDay = {
  date: string;
  /** Objectif du jour (kcal) ; pour un jour passé, l'objectif moyen. */
  kcal: number;
  /** Calories saisies (jours passés et aujourd'hui) ; null pour un jour à venir ou passé sans saisie. */
  consumed: number | null;
  larger: boolean;
  past: boolean;
};

export type WeekBudget = {
  weekStart: string;
  total: number;
  consumed: number;
  days: WeekDay[];
  /** Objectif recalculé pour `today`. */
  todayKcal: number;
  /** La semaine est déjà dépassée : les jours restants sont au minimum, sans report. */
  overspent: boolean;
};

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function weeklyBudget(input: {
  today: string;
  dailyKcal: number;
  floor: number;
  /** Calories saisies par jour de la semaine en cours. */
  consumed: ReadonlyMap<string, number>;
  largerDays: ReadonlySet<string>;
}): WeekBudget {
  const weekStart = isoWeekStart(input.today);
  const dates = weekDates(weekStart);
  const total = input.dailyKcal * 7;
  const pastDates = dates.filter((date) => date < input.today);
  // Un jour passé sans saisie compte comme l'objectif moyen : ne pas saisir ne « libère » rien.
  const consumedBefore = pastDates.reduce((sum, date) => sum + (input.consumed.get(date) ?? input.dailyKcal), 0);
  const remainingDates = dates.filter((date) => date >= input.today);

  const minDay = Math.max(input.floor, input.dailyKcal * MIN_DAY_SHARE);
  const bounds = remainingDates.map((date) => {
    const larger = input.largerDays.has(date);
    return {
      date,
      weight: larger ? LARGER_DAY_WEIGHT : 1,
      min: minDay,
      max: Math.max(minDay, input.dailyKcal * (larger ? MAX_LARGER_DAY_SHARE : MAX_DAY_SHARE)),
    };
  });
  const remaining = total - consumedBefore;
  const shares = distribute(remaining, bounds);
  const overspent = remaining < bounds.reduce((sum, day) => sum + day.min, 0);

  const days: WeekDay[] = dates.map((date) => ({
    date,
    kcal: date < input.today ? input.dailyKcal : roundTo10(shares.get(date) ?? minDay),
    consumed:
      date === input.today
        ? (input.consumed.get(date) ?? 0)
        : date < input.today
          ? (input.consumed.get(date) ?? null)
          : null,
    larger: input.largerDays.has(date),
    past: date < input.today,
  }));
  const consumed = dates.reduce((sum, date) => sum + (date <= input.today ? (input.consumed.get(date) ?? 0) : 0), 0);
  return {
    weekStart,
    total,
    consumed: Math.round(consumed),
    days,
    todayKcal: days.find((day) => day.date === input.today)!.kcal,
    overspent,
  };
}

/**
 * Répartit `amount` proportionnellement aux poids, chaque part restant dans [min, max]
 * (remplissage itératif : les parts bornées sont fixées, le reste est redistribué).
 */
function distribute(
  amount: number,
  days: readonly { date: string; weight: number; min: number; max: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  let free = [...days];
  let left = amount;
  while (free.length > 0) {
    const totalWeight = free.reduce((sum, day) => sum + day.weight, 0);
    const clamped = free.filter((day) => {
      const share = (left * day.weight) / totalWeight;
      return share < day.min || share > day.max;
    });
    if (clamped.length === 0) {
      for (const day of free) result.set(day.date, (left * day.weight) / totalWeight);
      break;
    }
    for (const day of clamped) {
      const share = (left * day.weight) / totalWeight;
      const value = share < day.min ? day.min : day.max;
      result.set(day.date, value);
    }
    for (const day of clamped) left -= result.get(day.date)!;
    free = free.filter((day) => !clamped.includes(day));
  }
  return result;
}

function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}
