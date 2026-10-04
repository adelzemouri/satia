import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { withDefaultPrefs } from "@/domain/notifications";
import { LanguageSwitcher } from "@/features/preferences/language-switcher";
import { parseTheme, THEME_COOKIE } from "@/features/preferences/theme";
import { ThemeSwitcher } from "@/features/preferences/theme-switcher";
import { WaterGoalForm } from "@/features/journal/water-goal-form";
import { DeviceSubscription } from "@/features/notifications/device-subscription";
import { NotificationPrefsForm } from "@/features/notifications/prefs-form";
import { HubLinks } from "@/features/navigation/hub-links";
import { LogoutForm } from "@/features/offline/logout-form";
import { DeleteAccountForm } from "@/features/profile/delete-account-form";
import { TwoFactorSection } from "@/features/profile/two-factor-section";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { subscriptionCount, vapidPublicKey } from "@/server/notifications";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { Icon } from "@/ui/icon";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const devices = await subscriptionCount(user.id);
  const t = await getTranslations("profile");
  const tn = await getTranslations("notifications");
  const tAll = await getTranslations();

  return (
    <>
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl font-extrabold text-primary"
        >
          {(profile?.firstName ?? user.email).slice(0, 1).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{profile?.firstName ?? t("title")}</h1>
          <p className="truncate text-text-muted">{user.email}</p>
        </div>
      </header>

      <HubLinks
        label={tAll("home.more")}
        links={[
          { href: "/coach", icon: "chat", label: tAll("coach.title") },
          { href: "/plan", icon: "book", label: tAll("kitchen.title"), hint: tAll("kitchen.hint") },
          { href: "/fasting", icon: "timer", label: tAll("fasting.title") },
          { href: "/treatment", icon: "pill", label: tAll("treatment.title") },
          { href: "/foods", icon: "star", label: tAll("add.manageFoods") },
          ...(user.role === "admin" ? [{ href: "/admin", icon: "admin", label: tAll("nav.admin") } as const] : []),
        ]}
      />

      <h2 className="mt-2 text-xl font-bold">{t("settings")}</h2>

      <Card aria-labelledby="prefs">
        <h2 id="prefs" className="text-xl font-semibold">
          {t("preferences")}
        </h2>
        <ThemeSwitcher initialTheme={theme} />
        <LanguageSwitcher />
        <WaterGoalForm goal={profile?.waterGoalGlasses ?? 8} />
      </Card>

      {profile && (
        <Card aria-labelledby="notifications">
          <h2 id="notifications" className="text-xl font-semibold">
            {tn("title")}
          </h2>
          <p className="text-text-muted">{tn("hint")}</p>
          <DeviceSubscription publicKey={vapidPublicKey()} devices={devices} />
          <NotificationPrefsForm prefs={withDefaultPrefs(profile.notificationPrefs)} />
        </Card>
      )}

      <Card aria-labelledby="ai-entry">
        <h2 id="ai-entry" className="text-xl font-semibold">
          {t("aiEntry")}
        </h2>
        <p className="text-text-muted">{t("aiEntryHint")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/containers" className={buttonClass("secondary")}>
            {t("containers")}
          </Link>
          <Link href="/dictionary" className={buttonClass("secondary")}>
            {t("dictionary")}
          </Link>
        </div>
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

      <LogoutForm>
        <button type="submit" className={buttonClass("secondary", "w-full")}>
          <Icon name="logout" />
          {tAll("nav.logout")}
        </button>
      </LogoutForm>

      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
