import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResetForm } from "@/features/auth/reset-form";
import { toLocale } from "@/i18n/routing";
import { findValidLink } from "@/server/accounts";
import { Alert } from "@/ui/alert";
import { AuthShell } from "@/ui/page-shell";

export default async function ResetPage({ params }: PageProps<"/[locale]/reset/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("reset");
  const link = await findValidLink(token, "password_reset");
  return <AuthShell title={t("title")}>{link ? <ResetForm token={token} /> : <Alert>{t("invalid")}</Alert>}</AuthShell>;
}
