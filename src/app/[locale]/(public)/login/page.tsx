import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/features/auth/login-form";
import { ClearPages } from "@/features/offline/clear-pages";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { hasAnyUser } from "@/server/accounts";
import { getCurrentUser } from "@/server/session";
import { AuthShell } from "@/ui/page-shell";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/", locale });
  if (!(await hasAnyUser())) redirect({ href: "/setup", locale });
  const t = await getTranslations("login");
  return (
    <AuthShell title={t("title")}>
      <ClearPages />
      <LoginForm />
    </AuthShell>
  );
}
