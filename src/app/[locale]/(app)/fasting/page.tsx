import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { deleteFastAction } from "@/features/fasting/actions";
import { FastTimer } from "@/features/fasting/fast-timer";
import { FastingPlanForm } from "@/features/fasting/plan-form";
import { DeleteButton } from "@/features/body/delete-button";
import { toLocale } from "@/i18n/routing";
import { fastingOverview } from "@/server/fasting";
import { requireUser } from "@/server/session";
import { Alert } from "@/ui/alert";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { Columns } from "@/ui/columns";

function duration(minutes: number) {
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

export default async function FastingPage({ params }: PageProps<"/[locale]/fasting">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const now = new Date();
  const overview = await fastingOverview(user.id, now);
  const t = await getTranslations("fasting");
  const format = await getFormatter();

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>

      {!overview.allowed ? (
        <Alert tone="info">{t("minor")}</Alert>
      ) : (
        <>
          <p className="text-text-muted">{t("intro")}</p>

          <Card aria-labelledby="timer-title">
            <h2 id="timer-title" className="text-xl font-semibold">
              {overview.current ? t("timer.running") : t("timer.title")}
            </h2>
            <FastTimer current={overview.current} next={overview.next} serverNow={now.toISOString()} />
          </Card>

          <Card aria-labelledby="plan-title">
            <h2 id="plan-title" className="text-xl font-semibold">
              {t("plan.title")}
            </h2>
            <FastingPlanForm plan={overview.plan} />
          </Card>

          <Card aria-labelledby="history-title">
            <h2 id="history-title" className="text-xl font-semibold">
              {t("history.title")}
            </h2>
            {overview.history.length === 0 ? (
              <EmptyState scene="timer">{t("history.empty")}</EmptyState>
            ) : (
              <>
                <p>
                  {t("history.stats", {
                    completed: overview.stats.completedLast7,
                    ...duration(overview.stats.averageMinutes ?? 0),
                  })}
                </p>
                <ul className="flex flex-col divide-y divide-border">
                  {overview.history.map((fast) => {
                    const minutes = Math.floor(
                      (new Date(fast.endedAt).getTime() - new Date(fast.startedAt).getTime()) / 60_000,
                    );
                    const day = format.dateTime(new Date(fast.startedAt), {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });
                    return (
                      <li key={fast.id} className="flex items-center gap-2 py-1">
                        <span className="flex flex-1 flex-col">
                          <span className="font-semibold first-letter:uppercase">{day}</span>
                          <span className="text-sm text-text-muted">
                            {t("history.line", { ...duration(minutes), target: Math.round(fast.targetMinutes / 60) })}
                            {minutes >= fast.targetMinutes && ` · ${t("history.reached")}`}
                          </span>
                        </span>
                        <DeleteButton
                          label={t("history.delete", { day })}
                          action={deleteFastAction.bind(null, fast.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        </>
      )}

      <p className="text-sm text-text-muted">{t("disclaimer")}</p>
    </Columns>
  );
}
