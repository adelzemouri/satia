import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WaterGoalForm } from "@/features/journal/water-goal-form";
import { LanguageSwitcher } from "@/features/preferences/language-switcher";
import { parseTheme, THEME_COOKIE } from "@/features/preferences/theme";
import { ThemeSwitcher } from "@/features/preferences/theme-switcher";
import { toLocale } from "@/i18n/routing";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function PreferencesPage({ params }: PageProps<"/[locale]/profile/preferences">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const t = await getTranslations("profile");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("preferences")}</h1>
      <Card>
        <ThemeSwitcher initialTheme={theme} />
        <LanguageSwitcher />
        <WaterGoalForm goal={profile?.waterGoalGlasses ?? 8} />
      </Card>
    </>
  );
}
