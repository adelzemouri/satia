/** Codes-barres alimentaires (GTIN : EAN-8, UPC-A, EAN-13, GTIN-14), calcul pur. */

/** Vérifie la clé de contrôle d'un GTIN (somme pondérée 3/1 depuis la droite). */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Nettoie un code saisi ou scanné et le ramène à la forme utilisée par Open Food Facts
 * (UPC-A sur 13 chiffres). Renvoie null si ce n'est pas un code alimentaire valide.
 */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, "");
  if (![8, 12, 13, 14].includes(code.length) || !hasValidCheckDigit(code)) return null;
  return code.length === 12 ? `0${code}` : code;
}
