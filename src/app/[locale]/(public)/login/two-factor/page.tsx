import { getTranslations, setRequestLocale } from "next-intl/server";

import { TwoFactorForm } from "@/features/auth/two-factor-form";
import { toLocale } from "@/i18n/routing";
import { AuthShell } from "@/ui/page-shell";

export default async function TwoFactorPage({ params }: PageProps<"/[locale]/login/two-factor">) {
  setRequestLocale(toLocale((await params).locale));
  const t = await getTranslations("twoFactor");
  return (
    <AuthShell title={t("title")} intro={t("intro")}>
      <TwoFactorForm />
    </AuthShell>
  );
}
