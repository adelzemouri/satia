/**
 * Numéro de version affiché : « 1.196 », où 196 est le nombre de modifications publiées sur la
 * branche principale. Il se calcule tout seul à la mise en ligne ; seul le premier chiffre
 * (APP_MAJOR_VERSION) se change à la main, pour marquer une étape.
 */
export function versionLabel(major: number, buildNumber: number | null, sha: string | null): string | null {
  if (buildNumber !== null && Number.isInteger(buildNumber) && buildNumber > 0) return `${major}.${buildNumber}`;
  // Sans historique complet (build hors Vercel, image Docker), le code court du commit reste lisible.
  return sha ? sha.slice(0, 7) : null;
}

/** Lit un nombre de modifications passé en variable d'environnement (chaîne vide ou invalide : rien). */
export function parseBuildNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
}
