import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { LanguageSwitcher } from "@/features/preferences/language-switcher";
import { parseTheme, THEME_COOKIE } from "@/features/preferences/theme";
import { ThemeSwitcher } from "@/features/preferences/theme-switcher";
import { DeleteAccountForm } from "@/features/profile/delete-account-form";
import { TwoFactorSection } from "@/features/profile/two-factor-section";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const t = await getTranslations("profile");

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="text-text-muted">{user.email}</p>

      <Card aria-labelledby="prefs">
        <h2 id="prefs" className="text-xl font-semibold">
          {t("preferences")}
        </h2>
        <ThemeSwitcher initialTheme={theme} />
        <LanguageSwitcher />
      </Card>

      <Card aria-labelledby="security">
        <h2 id="security" className="text-xl font-semibold">
          {t("security")}
        </h2>
        <TwoFactorSection enabled={user.twoFactorEnabled} />
      </Card>

      <Card aria-labelledby="data">
        <h2 id="data" className="text-xl font-semibold">
          {t("data")}
        </h2>
        <div className="flex flex-wrap gap-3">
          <a href="/api/me/export?format=json" className={buttonClass("secondary")} download>
            {t("exportJson")}
          </a>
          <a href="/api/me/export?format=csv" className={buttonClass("secondary")} download>
            {t("exportCsv")}
          </a>
        </div>
      </Card>

      <Card aria-labelledby="delete">
        <h2 id="delete" className="text-xl font-semibold">
          {t("deleteTitle")}
        </h2>
        <DeleteAccountForm />
      </Card>

      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
