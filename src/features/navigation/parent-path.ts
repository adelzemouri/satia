/** Où ramène le bouton « Retour » quand l'historique de l'app est vide. */

/** Écrans d'onglet : la barre du bas suffit, pas de bouton retour. */
const TAB_ROOTS = new Set([
  "/",
  "/recipes",
  "/plan",
  "/meals",
  "/add",
  "/progress",
  "/profile",
  "/onboarding",
  "/onboarding/install",
]);

/** Hub d'où dépend chaque page secondaire de premier niveau (le même que l'onglet allumé). */
const HUBS: Record<string, string> = {
  "/journal": "/",
  "/scan": "/add",
  "/shopping": "/plan",
  "/fridge": "/plan",
  "/family": "/plan",
  "/weight": "/progress",
  "/body": "/progress",
  "/activity": "/progress",
  "/training": "/progress",
  "/quality": "/progress",
  "/metabolism": "/progress",
};

/** Page parente, utilisée quand il n'y a pas d'historique dans l'app (lien ouvert directement). */
export function parentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 1) return `/${segments.slice(0, -1).join("/")}`;
  return HUBS[pathname] ?? "/profile";
}

export function isTabRoot(pathname: string): boolean {
  return TAB_ROOTS.has(pathname);
}
