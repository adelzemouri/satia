/** Nom de l'application, centralisé pour pouvoir le changer facilement. */
export const APP_NAME = "Pommelia";

export const APP_SHORT_NAME = "Pommelia";

/** Prénom du coach, affiché dans l'app et donné au modèle pour qu'il se présente pareil. */
export const COACH_NAME = "Pépin";

/** Couleurs utilisées hors CSS (manifest, balise theme-color). */
export const BRAND_COLORS = {
  light: "#F2F4F3",
  dark: "#0F1513",
} as const;

/** Fuseau horaire de référence pour « aujourd'hui » (usage familial en France). */
export const APP_TIMEZONE = "Europe/Paris";

/** Durées de validité des liens à usage unique. */
export const INVITE_TTL_DAYS = 7;
export const PASSWORD_RESET_TTL_HOURS = 24;
