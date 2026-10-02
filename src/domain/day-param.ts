/** Lit un paramètre de date « AAAA-MM-JJ » ; une date absente, invalide ou à venir donne aujourd'hui. */
export function parseDayParam(value: unknown, today: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return today;
  return value > today ? today : value;
}
