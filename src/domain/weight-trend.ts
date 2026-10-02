import { addDays } from "./energy";

/**
 * Tendance de poids lissée (moyenne mobile exponentielle sur les jours calendaires) :
 * une pesée isolée ne fait pas bouger la courbe, seule la tendance compte.
 */
export type WeighIn = { date: string; weightKg: number };
export type TrendPoint = { date: string; trendKg: number; weightKg: number | null };

/** Poids d'une nouvelle pesée dans la moyenne (≈ moyenne glissante sur 10 jours). */
export const TREND_SMOOTHING = 0.1;

export function weightTrend(weighIns: readonly WeighIn[]): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return [];

  const byDate = new Map(sorted.map((entry) => [entry.date, entry.weightKg]));
  const points: TrendPoint[] = [];
  let trend = first.weightKg;
  for (let date = first.date; date <= last.date; date = addDays(date, 1)) {
    const weight = byDate.get(date) ?? null;
    // Les jours sans pesée gardent la tendance du jour précédent.
    if (weight !== null) trend += TREND_SMOOTHING * (weight - trend);
    points.push({ date, trendKg: round2(trend), weightKg: weight });
  }
  return points;
}

/** Évolution hebdomadaire de la tendance sur les `days` derniers jours (régression linéaire). */
export function weeklyChangeKg(points: readonly TrendPoint[], days = 28): number | null {
  const recent = points.slice(-days);
  if (recent.length < 7) return null;
  const n = recent.length;
  const meanX = (n - 1) / 2;
  const meanY = recent.reduce((sum, point) => sum + point.trendKg, 0) / n;
  let num = 0;
  let den = 0;
  recent.forEach((point, x) => {
    num += (x - meanX) * (point.trendKg - meanY);
    den += (x - meanX) ** 2;
  });
  return round2((num / den) * 7);
}

/**
 * Date estimée d'atteinte du poids cible au rythme actuel, ou null si la tendance
 * ne va pas dans le bon sens (ou trop lentement pour une estimation utile : plus de 2 ans).
 */
export function projectGoalDate(lastTrend: TrendPoint, weeklyChange: number, targetKg: number): string | null {
  const remaining = targetKg - lastTrend.trendKg;
  if (remaining === 0) return lastTrend.date;
  if (weeklyChange === 0 || Math.sign(remaining) !== Math.sign(weeklyChange)) return null;
  const days = Math.ceil((remaining / weeklyChange) * 7);
  return days > 730 ? null : addDays(lastTrend.date, days);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
