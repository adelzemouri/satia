import { getTranslations, setRequestLocale } from "next-intl/server";

import { TwoFactorSection } from "@/features/profile/two-factor-section";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function SecurityPage({ params }: PageProps<"/[locale]/profile/security">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("profile");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("security")}</h1>
      <Card>
        <TwoFactorSection enabled={user.twoFactorEnabled} email={user.email} />
      </Card>
    </>
  );
}
