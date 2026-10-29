/** Appareil, pour n'afficher que les gestes qui le concernent. */
export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * Déduit l'appareil du navigateur. L'iPad se présente comme un Mac depuis iPadOS 13 :
 * on le reconnaît à son écran tactile.
 */
export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** Vrai quand Pommelia est ouverte depuis son icône (écran d'accueil ou fenêtre d'app). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Lien qui ouvre la fiche d'installation, et adresse encodée dans le QR code sur ordinateur. */
export const INSTALL_HASH = "installer";
export const INSTALL_PATH = `/profile#${INSTALL_HASH}`;
