/** Affiche une date « AAAA-MM-JJ » sans dépendre du fuseau du serveur ou du téléphone. */
export function formatDay(isoDate: string, locale: string, style: "long" | "compact" | "short" = "long"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
      : style === "compact"
        ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Jour de la semaine abrégé (« lun. »), pour le bandeau de semaine du journal. */
export function formatWeekday(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
