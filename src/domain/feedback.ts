/** Remarques et signalements envoyés depuis l'app à l'admin du foyer. */
export const FEEDBACK_KINDS = ["remark", "bug"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Assez pour décrire un souci en détail, pas pour coller un roman. */
export const FEEDBACK_MAX_LENGTH = 2000;

/** Captures purgées comme les photos de repas, au bout de cette durée. */
export const FEEDBACK_SCREENSHOT_RETENTION_DAYS = 90;

/**
 * Appareil et navigateur lisibles d'après le user-agent (« iPhone, Safari »), pour que l'admin
 * sache où reproduire. Volontairement grossier : quelques cas courants, sinon null.
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /Firefox\/|FxiOS\//.test(ua)
        ? "Firefox"
        : /CriOS\/|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const parts = [device, browser].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Ne garde qu'un chemin de l'app (« /journal »), jamais une URL externe ni de paramètres. */
export function cleanPagePath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/)[0]!.slice(0, 200);
  return /^\/[\w\-/.]*$/.test(path) ? path : null;
}
