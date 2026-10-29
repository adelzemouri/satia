import { setRequestLocale } from "next-intl/server";

import { InstallWelcome } from "@/features/install/install-welcome";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";

export default async function OnboardingInstallPage({ params }: PageProps<"/[locale]/onboarding/install">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  return <InstallWelcome />;
}
