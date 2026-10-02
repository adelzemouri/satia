import { setRequestLocale } from "next-intl/server";

import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";

export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  return <OnboardingWizard defaultFirstName={user.name} />;
}
