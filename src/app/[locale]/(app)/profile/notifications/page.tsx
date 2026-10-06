import { getTranslations, setRequestLocale } from "next-intl/server";

import { withDefaultPrefs } from "@/domain/notifications";
import { DeviceSubscription } from "@/features/notifications/device-subscription";
import { NotificationPrefsForm } from "@/features/notifications/prefs-form";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { subscriptionCount, vapidPublicKey } from "@/server/notifications";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function NotificationsPage({ params }: PageProps<"/[locale]/profile/notifications">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  const devices = await subscriptionCount(user.id);
  const t = await getTranslations("notifications");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("hint")}</p>
      <Card>
        <DeviceSubscription publicKey={vapidPublicKey()} devices={devices} />
        <NotificationPrefsForm prefs={withDefaultPrefs(profile.notificationPrefs)} />
      </Card>
    </>
  );
}
