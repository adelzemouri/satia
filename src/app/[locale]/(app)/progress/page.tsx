import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { HubLinks } from "@/features/navigation/hub-links";
import { CheckinCard } from "@/features/quality/checkin-card";
import { FeelingHistory } from "@/features/quality/feeling-history";
import { toLocale } from "@/i18n/routing";
import { latestWeight } from "@/server/journal";
import { checkinOn, feelingHistory } from "@/server/quality";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

/** Onglet « Progrès » : le ressenti du jour, puis le suivi dans le temps (poids, corps, activité…). */
export default async function ProgressPage({ params }: PageProps<"/[locale]/progress">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const [checkin, weight, history] = await Promise.all([
    checkinOn(user.id, today),
    latestWeight(user.id, today),
    feelingHistory(user.id, today),
  ]);
  const t = await getTranslations();

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("progress.title")}</h1>

      <Card aria-labelledby="checkin-title">
        <h2 id="checkin-title" className="text-xl font-bold">
          {t("checkin.title")}
        </h2>
        <p className="text-sm text-text-muted">{t("checkin.hint")}</p>
        <CheckinCard date={today} initial={checkin} />
      </Card>

      <Card aria-labelledby="history-title">
        <div className="flex flex-col">
          <h2 id="history-title" className="text-xl font-bold">
            {t("progress.history.title")}
          </h2>
          <p className="text-sm text-text-muted">{t("progress.history.intro")}</p>
        </div>
        <FeelingHistory days={history} />
      </Card>

      <HubLinks
        label={t("home.more")}
        links={[
          {
            href: "/weight",
            icon: "weight",
            label: t("weight.title"),
            hint: weight === null ? undefined : t("progress.lastWeight", { value: weight }),
          },
          { href: "/training", icon: "dumbbell", label: t("nav.training") },
          { href: "/activity", icon: "run", label: t("activity.title") },
          { href: "/body", icon: "ruler", label: t("body.title") },
          { href: "/week", icon: "calendar", label: t("week.title") },
          { href: "/quality", icon: "sprout", label: t("quality.title") },
          { href: "/metabolism", icon: "pulse", label: t("metabolism.title") },
        ]}
      />
    </>
  );
}
