/**
 * Échec d'un appel serveur faute de réseau (et non refus du serveur) : hors ligne, ou requête
 * coupée en route. Safari dit « Load failed », Chrome « Failed to fetch » : toujours un TypeError.
 */
export function isNetworkFailure(error: unknown): boolean {
  return (typeof navigator !== "undefined" && navigator.onLine === false) || error instanceof TypeError;
}

/**
 * Enveloppe une action de formulaire : une coupure réseau devient l'erreur `network`, affichée
 * dans le formulaire, au lieu de faire tomber tout l'écran sur la page d'erreur.
 * Les autres erreurs (redirections de Next.js comprises) passent telles quelles.
 */
export function withNetworkFallback<State, Result, Args extends unknown[]>(
  action: (state: State, ...args: Args) => Result | Promise<Result>,
): (state: State, ...args: Args) => Promise<Result> {
  return async (state, ...args) => {
    try {
      return await action(state, ...args);
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return { ...(state ?? {}), ok: undefined, error: "network", fieldErrors: undefined } as Result;
    }
  };
}
