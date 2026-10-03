import { getTranslations, setRequestLocale } from "next-intl/server";

import { localClock } from "@/domain/notifications";
import { DeleteButton } from "@/features/body/delete-button";
import { deleteTreatmentAction, deleteTreatmentLogAction } from "@/features/treatment/actions";
import { TreatmentLogForm } from "@/features/treatment/log-form";
import { TreatmentForm } from "@/features/treatment/treatment-form";
import { APP_TIMEZONE } from "@/config/app";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { treatmentOverview } from "@/server/treatment";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { EmptyState } from "@/ui/empty-state";

export default async function TreatmentPage({ params }: PageProps<"/[locale]/treatment">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const overview = await treatmentOverview(user.id);
  const t = await getTranslations("treatment");
  const tw = await getTranslations("training.weekdays");
  const clock = localClock(new Date(), APP_TIMEZONE);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>

      <Card aria-labelledby="log-title">
        <h2 id="log-title" className="text-xl font-semibold">
          {t("log.title")}
        </h2>
        <TreatmentLogForm
          // Nouvelle liste de traitements : le formulaire repart sur le premier.
          key={overview.treatments.map((treatment) => treatment.id).join()}
          treatments={overview.treatments.map((treatment) => ({ id: treatment.id, name: treatment.name }))}
          today={clock.date}
          now={clock.time}
        />
      </Card>

      <Card aria-labelledby="logs-title">
        <h2 id="logs-title" className="text-xl font-semibold">
          {t("logs.title")}
        </h2>
        {overview.logs.length === 0 ? (
          <EmptyState scene="pill">{t("logs.empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {overview.logs.map((log) => (
              <li key={log.id} className="flex items-center gap-2 py-1">
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{log.name}</span>
                  <span className="text-sm text-text-muted first-letter:uppercase">
                    {t("logs.when", { date: formatDay(log.date, locale, "short"), time: log.time })}
                    {log.note && ` · ${log.note}`}
                  </span>
                </span>
                <DeleteButton
                  label={t("logs.delete", { name: log.name, date: formatDay(log.date, locale, "short") })}
                  action={deleteTreatmentLogAction.bind(null, log.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="list-title">
        <h2 id="list-title" className="text-xl font-semibold">
          {t("list.title")}
        </h2>
        {overview.treatments.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {overview.treatments.map((treatment) => (
              <li key={treatment.id} className="flex items-center gap-2 py-1">
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{treatment.name}</span>
                  <span className="text-sm text-text-muted">
                    {treatment.reminderTime
                      ? t("list.reminder", {
                          days: treatment.reminderDays.map((day) => tw(String(day) as "0")).join(", "),
                          time: treatment.reminderTime,
                        })
                      : t("list.noReminder")}
                  </span>
                </span>
                <DeleteButton
                  label={t("list.delete", { name: treatment.name })}
                  action={deleteTreatmentAction.bind(null, treatment.id)}
                />
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-semibold">{t("add.title")}</h3>
        <TreatmentForm />
      </Card>

      <p className="text-sm text-text-muted">{t("disclaimer")}</p>
    </>
  );
}
