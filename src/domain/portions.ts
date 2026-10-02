/** « ½ », « 1 », « 1½ », « 2 »… pour afficher une portion de plat partagé (calcul pur). */
export function portionLabel(value: number): string {
  const whole = Math.floor(value);
  const rest = Math.round((value - whole) * 100) / 100;
  const fraction = rest === 0.5 ? "½" : rest === 0.25 ? "¼" : rest === 0.75 ? "¾" : rest === 0 ? "" : null;
  if (fraction === null) return String(value);
  return whole === 0 ? fraction : `${whole}${fraction}`;
}
