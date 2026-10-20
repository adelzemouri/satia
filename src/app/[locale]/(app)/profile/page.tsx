import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { FEEDBACK_HASH, FeedbackHost } from "@/features/feedback/feedback-host";
import { HubLinks } from "@/features/navigation/hub-links";
import { PrivateText } from "@/ui/private";
import { LogoutForm } from "@/features/offline/logout-form";
import { toLocale } from "@/i18n/routing";
import { goalChangesWeight } from "@/domain/profile";
import { type FastingPlan } from "@/domain/fasting";
import { fastingAllowed, getFastingPlan } from "@/server/fasting";
import { feedbackRecipient, unreadFeedbackCount } from "@/server/feedback";
import { latestWeight } from "@/server/journal";
import { getGoalOn, getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { currentVersion } from "@/server/version";
import { buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [profile, goal, weight, fasting, fastingOk] = await Promise.all([
    getProfile(user.id),
    getGoalOn(user.id),
    latestWeight(user.id),
    getFastingPlan(user.id),
    fastingAllowed(user.id),
  ]);
  const t = await getTranslations("profile");
  const tg = await getTranslations("goals");
  const tOn = await getTranslations("onboarding");
  const format = await getFormatter();
  const kg = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const tn = await getTranslations("notifications");
  const tAll = await getTranslations();
  const tf = await getTranslations("feedback");
  const [recipient, unread] = await Promise.all([
    feedbackRecipient(user.id),
    user.role === "admin" ? unreadFeedbackCount(user.householdId) : Promise.resolve(0),
  ]);
  // L'admin qui reçoit les messages ne s'écrit pas « à lui-même ».
  const version = currentVersion();
  const recipientName = recipient && recipient.id !== user.id ? recipient.name : null;

  return (
    // Sur ordinateur, une grille : objectifs puis réglages à gauche, raccourcis puis déconnexion à
    // droite. Les deux colonnes ont un titre, donc leurs cartes démarrent à la même hauteur.
    <div data-wide className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-8">
      <header className="flex items-center gap-4 lg:col-span-2">
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

      {profile && goal && (
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
          <h2 className="mt-2 text-lg font-bold">{tg("title")}</h2>
          <HubLinks
            label={tg("title")}
            links={[
              {
                href: "/profile/goals/objective",
                icon: "sprout",
                label: tg("objective"),
                value: tOn(`goal.${profile.goal}`),
              },
              ...(goalChangesWeight(profile.goal)
                ? [
                    {
                      href: "/profile/goals/weight",
                      icon: "weight",
                      label: tg("targetWeight"),
                      // Le poids reste masqué ici comme ailleurs (PrivateText), tant qu'on ne l'a pas affiché.
                      value: profile.targetWeightKg ? (
                        <PrivateText>{`${kg(weight ?? profile.startWeightKg)} → ${kg(profile.targetWeightKg)} kg`}</PrivateText>
                      ) : (
                        tg("targetNone")
                      ),
                    } as const,
                  ]
                : []),
              {
                href: "/profile/goals/calories",
                icon: "pulse",
                label: tg("calories"),
                value: tg(profile.goalLocked ? "kcalManual" : "kcalAuto", { kcal: format.number(goal.kcal) }),
              },
              {
                href: "/profile/goals/water",
                icon: "drop",
                label: tg("water"),
                value: tg("waterValue", { liters: format.number(profile.waterGoalGlasses / 4) }),
              },
              ...(fastingOk
                ? [{ href: "/fasting", icon: "timer", label: tg("fasting"), value: fastingValue(fasting, tg) } as const]
                : []),
              {
                href: "/profile/goals/activity",
                icon: "run",
                label: tg("activity"),
                value: tOn(`activity.${profile.activityLevel}.label`),
              },
            ]}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <h2 className="mt-2 text-lg font-bold">{tAll("home.more")}</h2>
        <HubLinks
          label={tAll("home.more")}
          links={[
            { href: "/coach", icon: "chat", label: tAll("coach.title") },
            { href: "/journal", icon: "journal", label: tAll("nav.journal"), hint: tAll("profile.journalHint") },
            { href: "/treatment", icon: "pill", label: tAll("treatment.title") },
            { href: "/foods", icon: "star", label: tAll("add.manageFoods") },
            {
              href: { pathname: "/profile", hash: FEEDBACK_HASH },
              icon: "mail",
              label: tf("entry"),
              hint: recipientName ? tf("entryHintTo", { name: recipientName }) : tf("entryHint"),
            },
            ...(user.role === "admin"
              ? [
                  {
                    href: "/admin",
                    icon: "admin",
                    label: tAll("nav.admin"),
                    value:
                      unread > 0 ? (
                        <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-on-accent tabular-nums">
                          {tf("inbox.new", { count: unread })}
                        </span>
                      ) : undefined,
                  } as const,
                ]
              : []),
          ]}
        />
      </div>

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-3">
        <h2 className="mt-2 text-lg font-bold">{t("settings")}</h2>
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

      {/* Sur ordinateur, à hauteur de la carte des réglages (sous leur titre). */}
      <div className="lg:col-start-2 lg:row-start-3 lg:pt-12">
        <LogoutForm>
          <button type="submit" className={buttonClass("secondary", "w-full lg:max-w-xs")}>
            <Icon name="logout" />
            {tAll("nav.logout")}
          </button>
        </LogoutForm>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-2">
        <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
        {version.label && (
          <p className="text-xs text-text-muted tabular-nums">
            {version.builtAt
              ? t("version", {
                  number: version.label,
                  date: format.dateTime(version.builtAt, { day: "numeric", month: "short" }),
                })
              : t("versionNoDate", { number: version.label })}
          </p>
        )}
      </div>

      <FeedbackHost recipient={recipientName} />
    </div>
  );
}

/** Résumé du planning de jeûne : le protocole le plus fréquent de la semaine, ou « Désactivé ». */
function fastingValue(
  plan: FastingPlan,
  t: (key: "fastingOff" | "fastingHours", values?: { hours: number }) => string,
) {
  const days = plan.days.filter((day) => day !== null);
  if (!plan.enabled || days.length === 0) return t("fastingOff");
  const counts = new Map<string, number>();
  for (const day of days) counts.set(day.protocol, (counts.get(day.protocol) ?? 0) + 1);
  const [protocol] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return protocol === "custom" ? t("fastingHours", { hours: plan.customHours }) : protocol;
}
