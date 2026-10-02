import { APP_TIMEZONE } from "@/config/app";

/** Date du jour « AAAA-MM-JJ » dans le fuseau de l'application. */
export function todayIso(now: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
