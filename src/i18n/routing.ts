import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
  // Français par défaut quelle que soit la langue du navigateur ; le choix explicite est mémorisé.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** Valide un segment `[locale]` ; le layout a déjà renvoyé 404 pour une locale inconnue. */
export function toLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
