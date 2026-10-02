/** Affiche une date « AAAA-MM-JJ » sans dépendre du fuseau du serveur ou du téléphone. */
export function formatDay(isoDate: string, locale: string, style: "long" | "short" = "long"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
      : { day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${isoDate}T00:00:00Z`));
}
