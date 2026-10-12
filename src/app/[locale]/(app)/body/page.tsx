import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { deleteMeasurementAction, deleteProgressPhotoAction } from "@/features/body/actions";
import { DeleteButton } from "@/features/body/delete-button";
import { MeasurementForm } from "@/features/body/measurement-form";
import { ProgressPhotoForm } from "@/features/body/progress-photo-form";
import { toLocale } from "@/i18n/routing";
import { measurementOverview, progressPhotoOverview } from "@/server/body";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";
import { EmptyState } from "@/ui/empty-state";
import { Columns } from "@/ui/columns";
import { ScrollToHash } from "@/ui/scroll-to-hash";

export default async function BodyPage({ params }: PageProps<"/[locale]/body">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [measurements, photos] = await Promise.all([measurementOverview(user.id), progressPhotoOverview(user.id)]);
  const t = await getTranslations("body");
  const today = todayIso();
  const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero", maximumFractionDigits: 1 });

  return (
    <Columns>
      <ScrollToHash />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>

      <Card aria-labelledby="measure-title">
        <h2 id="measure-title" className="text-xl font-semibold">
          {t("measureTitle")}
        </h2>
        <MeasurementForm today={today} />
      </Card>

      <Card aria-labelledby="changes-title">
        <h2 id="changes-title" className="text-xl font-semibold">
          {t("changesTitle")}
        </h2>
        {measurements.changes.length === 0 ? (
          <EmptyState scene="tape">{t("empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {measurements.changes.map((row) => (
              <li key={row.kind} className="flex items-baseline justify-between gap-3 py-2">
                <span className="font-semibold">{t(`kinds.${row.kind}`)}</span>
                <span>
                  <span>{t("cm", { value: row.latest })}</span>
                  <span className="ml-2 text-sm text-text-muted">
                    {row.change === 0 ? t("stable") : t("change", { value: signed.format(row.change) })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {measurements.history.length > 0 && (
          <details>
            <summary className="cursor-pointer font-semibold text-primary">{t("history")}</summary>
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {measurements.history.map((row) => (
                <li key={`${row.date}-${row.kind}`} className="flex items-center gap-2 py-1">
                  <span className="flex-1 first-letter:uppercase">
                    {formatDay(row.date, locale, "short")} · {t(`kinds.${row.kind}`)}
                  </span>
                  <span className="font-semibold">{t("cm", { value: row.valueCm })}</span>
                  <DeleteButton
                    label={t("delete", { kind: t(`kinds.${row.kind}`), date: formatDay(row.date, locale, "short") })}
                    action={deleteMeasurementAction.bind(null, row.date, row.kind)}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card aria-labelledby="photos-title">
        <h2 id="photos-title" className="text-xl font-semibold">
          {t("photos.title")}
        </h2>
        <ProgressPhotoForm today={today} />
      </Card>

      {photos.compare.length > 0 && (
        <Card aria-labelledby="compare-title">
          <h2 id="compare-title" className="text-xl font-semibold">
            {t("photos.compare")}
          </h2>
          {photos.compare.map(({ pose, first, latest }) => (
            <figure key={pose} className="flex flex-col gap-2">
              <figcaption className="font-semibold">{t(`photos.poses.${pose}`)}</figcaption>
              <div className="grid grid-cols-2 gap-2">
                {[first, latest].map((photo) => (
                  <div key={photo.id} className="flex flex-col gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
                    <img
                      src={photo.url}
                      alt={t("photos.alt", { pose: t(`photos.poses.${pose}`), date: formatDay(photo.date, locale) })}
                      className="aspect-[3/4] w-full rounded-2xl object-cover"
                    />
                    <span className="text-sm text-text-muted">{formatDay(photo.date, locale, "short")}</span>
                  </div>
                ))}
              </div>
            </figure>
          ))}
        </Card>
      )}

      {photos.recent.length > 0 && (
        <Card aria-labelledby="gallery-title">
          <h2 id="gallery-title" className="text-xl font-semibold">
            {t("photos.recent")}
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {photos.recent.map((photo) => {
              const label = t("photos.alt", {
                pose: t(`photos.poses.${photo.pose}`),
                date: formatDay(photo.date, locale),
              });
              return (
                <li key={photo.id} className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
                  <img src={photo.url} alt={label} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <DeleteButton
                    label={t("photos.delete", {
                      pose: t(`photos.poses.${photo.pose}`),
                      date: formatDay(photo.date, locale, "short"),
                    })}
                    action={deleteProgressPhotoAction.bind(null, photo.id)}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Columns>
  );
}
