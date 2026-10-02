import { getTranslations, setRequestLocale } from "next-intl/server";

import { FridgeScanner } from "@/features/planning/fridge-scanner";
import { toLocale } from "@/i18n/routing";
import { aiAvailability } from "@/server/ai-availability";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function FridgePage({ params }: PageProps<"/[locale]/fridge">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const ai = await aiAvailability();
  const t = await getTranslations();
  const unavailable = ai === null ? "ai_not_configured" : ai.available ? null : ai.reason;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("fridge.title")}</h1>
      <p className="text-text-muted">{t("fridge.intro")}</p>
      <Card>
        {unavailable ? (
          <p className="text-text-muted">{t(`errors.${unavailable as "ai_disabled"}`)}</p>
        ) : (
          <FridgeScanner />
        )}
      </Card>
    </>
  );
}
