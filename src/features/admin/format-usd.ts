import type { createFormatter } from "next-intl";

/**
 * Montant en dollars. Un appel coûte souvent moins d'un centime : en dessous, on garde deux
 * chiffres significatifs (0,00014 $) plutôt que d'afficher 0,00 $.
 */
export function formatUsd(format: ReturnType<typeof createFormatter>, micros: number): string {
  const usd = micros / 1_000_000;
  return format.number(
    usd,
    usd > 0 && usd < 0.01
      ? { style: "currency", currency: "USD", maximumSignificantDigits: 2 }
      : { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
}
