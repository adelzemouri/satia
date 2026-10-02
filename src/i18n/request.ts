import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { APP_TIMEZONE } from "@/config/app";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Même fuseau au rendu serveur et dans le navigateur : les heures affichées ne bougent pas à l'hydratation.
    timeZone: APP_TIMEZONE,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
