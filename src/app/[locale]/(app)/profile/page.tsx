import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { HubLinks } from "@/features/navigation/hub-links";
import { LogoutForm } from "@/features/offline/logout-form";
import { toLocale } from "@/i18n/routing";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Columns } from "@/ui/columns";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  const t = await getTranslations("profile");
  const tn = await getTranslations("notifications");
  const tAll = await getTranslations();

  return (
    <Columns>
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

      <div data-col>
        <HubLinks
          label={tAll("home.more")}
          links={[
            { href: "/coach", icon: "chat", label: tAll("coach.title") },
            { href: "/journal", icon: "journal", label: tAll("nav.journal"), hint: tAll("profile.journalHint") },
            { href: "/fasting", icon: "timer", label: tAll("fasting.title") },
            { href: "/treatment", icon: "pill", label: tAll("treatment.title") },
            { href: "/foods", icon: "star", label: tAll("add.manageFoods") },
            ...(user.role === "admin" ? [{ href: "/admin", icon: "admin", label: tAll("nav.admin") } as const] : []),
          ]}
        />
      </div>

      <div data-col className="flex flex-col gap-6">
        <h2 className="mt-2 text-lg font-bold lg:mt-0">{t("settings")}</h2>
        <HubLinks
          label={t("settings")}
          links={[
            { href: "/profile/preferences", icon: "sliders", label: t("preferences"), hint: t("preferencesHint") },
            ...(profile
              ? [
                  {
                    href: "/profile/notifications",
                    icon: "bell",
                    label: tn("title"),
                    hint: t("notificationsHint"),
                  } as const,
                ]
              : []),
            { href: "/containers", icon: "sparkle", label: t("containers"), hint: t("containersHint") },
            { href: "/dictionary", icon: "book", label: t("dictionary"), hint: t("dictionaryHint") },
            {
              href: "/profile/security",
              icon: "lock",
              label: t("security"),
              hint: t(user.twoFactorEnabled ? "securityOn" : "securityOff"),
            },
            { href: "/profile/account", icon: "download", label: t("data"), hint: t("dataHint") },
          ]}
        />
      </div>

      <LogoutForm>
        <button type="submit" className={buttonClass("secondary", "w-full lg:max-w-xs")}>
          <Icon name="logout" />
          {tAll("nav.logout")}
        </button>
      </LogoutForm>

      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </Columns>
  );
}
