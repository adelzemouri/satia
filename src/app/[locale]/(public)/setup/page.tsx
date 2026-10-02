import { getTranslations, setRequestLocale } from "next-intl/server";

import { SetupForm } from "@/features/auth/setup-form";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { hasAnyUser } from "@/server/accounts";
import { AuthShell } from "@/ui/page-shell";

export default async function SetupPage({ params }: PageProps<"/[locale]/setup">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  if (await hasAnyUser()) redirect({ href: "/login", locale });
  const t = await getTranslations("setup");
  return (
    <AuthShell title={t("title")} intro={t("intro")}>
      <SetupForm />
    </AuthShell>
  );
}
