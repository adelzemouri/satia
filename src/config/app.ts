/** Nom de l'application, centralisé pour pouvoir le changer facilement. */
export const APP_NAME = "Satia";

export const APP_SHORT_NAME = "Satia";

/** Couleurs utilisées hors CSS (manifest, balise theme-color). */
export const BRAND_COLORS = {
  cream: "#F7F2E8",
  oliveDark: "#1C1F16",
} as const;

/** Fuseau horaire de référence pour « aujourd'hui » (usage familial en France). */
export const APP_TIMEZONE = "Europe/Paris";

/** Durées de validité des liens à usage unique. */
export const INVITE_TTL_DAYS = 7;
export const PASSWORD_RESET_TTL_HOURS = 24;
