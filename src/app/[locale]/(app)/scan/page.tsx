import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { APP_TIMEZONE } from "@/config/app";
import { MEAL_SLOTS, slotAt } from "@/domain/meals";
import { ScanView } from "@/features/scan/scan-view";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";

export default async function ScanPage({ params, searchParams }: PageProps<"/[locale]/scan">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot) ?? slotAt(new Date(), APP_TIMEZONE);
  const t = await getTranslations("scan");
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <ScanView date={date} slot={slot} />
    </>
  );
}
