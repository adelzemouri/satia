import { getTranslations, setRequestLocale } from "next-intl/server";

import { STEP_BASELINES } from "@/domain/activity";
import { todayIso } from "@/domain/dates";
import { deleteActivityAction } from "@/features/activity/actions";
import { ActivityForm } from "@/features/activity/activity-form";
import { ImportForm } from "@/features/activity/import-form";
import { StepsChart } from "@/features/activity/steps-chart";
import { StepsForm } from "@/features/activity/steps-form";
import { DeleteButton } from "@/features/body/delete-button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { activityOverview } from "@/server/activity";
import { daySummary } from "@/server/journal";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { EmptyState } from "@/ui/empty-state";
import { Columns } from "@/ui/columns";

export default async function ActivityPage({ params }: PageProps<"/[locale]/activity">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const today = todayIso();
  const [overview, summary, profile] = await Promise.all([
    activityOverview(user.id, today),
    daySummary(user.id, today),
    getProfile(user.id),
  ]);
  const t = await getTranslations("activity");
  const burned = summary.activity.burnedKcal + summary.training.burnedKcal;
  const baseline = profile ? STEP_BASELINES[profile.activityLevel] : null;

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>

      <Card aria-labelledby="today-activity">
        <h2 id="today-activity" className="text-xl font-semibold">
          {t("today")}
        </h2>
        <p className="font-display text-2xl font-extrabold tracking-tight">{t("burned", { kcal: burned })}</p>
        <p className="text-sm text-text-muted">{t("goalHint")}</p>
      </Card>

      <Card aria-labelledby="add-activity">
        <h2 id="add-activity" className="text-xl font-semibold">
          {t("add")}
        </h2>
        <ActivityForm today={today} />
      </Card>

      <Card aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-xl font-semibold">
          {t("steps.title")}
        </h2>
        <StepsForm today={today} todaySteps={summary.activity.steps} />
        {baseline !== null && <p className="text-sm text-text-muted">{t("steps.hint", { baseline })}</p>}
        {overview.steps.length > 0 && (
          <div className="hidden lg:block">
            <StepsChart steps={overview.steps} today={today} locale={locale} />
          </div>
        )}
        {overview.steps.length > 0 && (
          <ul className="flex flex-col divide-y divide-border lg:hidden">
            {[...overview.steps].reverse().map((row) => (
              <li key={row.date} className="flex justify-between gap-3 py-1">
                <span className="first-letter:uppercase">{formatDay(row.date, locale, "short")}</span>
                <span className="font-semibold">{t("steps.value", { steps: row.steps })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="recent-title">
        <h2 id="recent-title" className="text-xl font-semibold">
          {t("recent")}
        </h2>
        {overview.activities.length === 0 ? (
          <EmptyState scene="shoe">{t("empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {overview.activities.map((activity) => {
              const name = t(`types.${activity.type}`);
              return (
                <li key={activity.id} className="flex items-center gap-2 py-1">
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{name}</span>
                    <span className="text-sm text-text-muted first-letter:uppercase">
                      {formatDay(activity.date, locale, "short")} ·{" "}
                      {t("line", {
                        minutes: activity.durationMin,
                        intensity: t(`intensities.${activity.intensity}`),
                        kcal: activity.kcal,
                      })}
                      {activity.source === "import" && ` · ${t("imported")}`}
                    </span>
                  </span>
                  <DeleteButton
                    label={t("delete", { name, date: formatDay(activity.date, locale, "short") })}
                    action={deleteActivityAction.bind(null, activity.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/training" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("trainingLink")}
        </Link>
      </Card>

      <Card aria-labelledby="import-title">
        <h2 id="import-title" className="text-xl font-semibold">
          {t("import.title")}
        </h2>
        <ImportForm />
      </Card>
    </Columns>
  );
}
