import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { revokeInviteAction } from "@/features/admin/actions";
import { BetaGuestRow } from "@/features/admin/beta-guest-row";
import { BetaGuestStrip } from "@/features/admin/beta-guest-strip";
import { DemoAccount } from "@/features/admin/demo-account";
import { FloorsForm } from "@/features/admin/floors-form";
import { InviteForm } from "@/features/admin/invite-form";
import { formatUsd } from "@/features/admin/format-usd";
import { MemberActions } from "@/features/admin/member-actions";
import { FeedbackInbox } from "@/features/feedback/feedback-inbox";
import { VapidKeys } from "@/features/admin/vapid-keys";
import { Link } from "@/i18n/navigation";
import { daysBetween } from "@/domain/adaptive";
import { betaSummary, GUEST_FEATURES, type GuestActivity } from "@/domain/beta";
import { todayIso } from "@/domain/dates";
import { DEMO_EMAIL } from "@/domain/demo";
import { toLocale } from "@/i18n/routing";
import { llmConfig } from "@/llm/config";
import { aiStatus } from "@/llm/guard";
import { currentMonthCostByUser } from "@/llm/usage";
import { listGuests, listMembers, listPendingInvites } from "@/server/accounts";
import { guestActivities, guestDetails } from "@/server/beta";
import { listFeedback } from "@/server/feedback";
import { vapidPublicKey } from "@/server/notifications";
import { demoAccountStatus } from "@/server/demo";
import { requireAdmin } from "@/server/session";
import { getCalorieFloors } from "@/server/settings";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { Icon } from "@/ui/icon";
import { Columns } from "@/ui/columns";

/** Teintes du vert de l'appli, de la façon de noter la plus utilisée à la moins utilisée. */
const WAY_SHADES = ["bg-primary", "bg-primary/70", "bg-primary/45", "bg-primary/25", "bg-border"] as const;

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const admin = await requireAdmin(locale);
  const [members, guests, invites, floors, demo, costs, ai, feedback] = await Promise.all([
    listMembers(admin.householdId),
    listGuests(admin.householdId),
    listPendingInvites(admin.householdId),
    getCalorieFloors(),
    demoAccountStatus(),
    currentMonthCostByUser(),
    aiStatus(llmConfig()),
    listFeedback(admin.householdId),
  ]);
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const monthCost = (userId: string) => t("monthCost", { cost: formatUsd(format, costs.get(userId) ?? 0) });
  const [activities, details] = await Promise.all([
    guestActivities(guests),
    guestDetails(guests.map((guest) => guest.id)),
  ]);
  const summary = betaSummary([...activities.values()]);
  const dayWhen = (day: string) => {
    const days = daysBetween(day, todayIso());
    return days <= 0 ? t("beta.today") : days === 1 ? t("beta.yesterday") : t("beta.daysAgo", { days });
  };
  const statusPill = (activity: GuestActivity) => {
    const { status } = activity;
    if (status.kind === "idle")
      return ["bg-accent-soft text-accent", t("beta.statusIdle", { days: status.days })] as const;
    if (status.kind === "new") return ["bg-surface-muted text-text-muted", t("beta.statusNew")] as const;
    return ["bg-primary-soft text-primary", t("beta.statusActive")] as const;
  };

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>

      <Card aria-labelledby="remarques">
        <FeedbackInbox
          items={feedback.map(({ createdAt, ...item }) => ({
            ...item,
            createdAt: createdAt.toISOString(),
            when: format.relativeTime(createdAt),
          }))}
        />
      </Card>

      <Card aria-labelledby="members">
        <h2 id="members" className="text-xl font-semibold">
          {t("members")}
        </h2>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{member.name}</span>
                {member.id === admin.id && <span className="text-sm text-text-muted">({t("you")})</span>}
                <span className="text-sm text-text-muted">{member.email}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="rounded-full bg-surface-muted px-3 py-1">{t(`role.${member.role}`)}</span>
                {member.twoFactorEnabled && (
                  <span className="rounded-full bg-primary-soft px-3 py-1">{t("twoFactor")}</span>
                )}
              </div>
              <p className="text-sm text-text-muted tabular-nums">{monthCost(member.id)}</p>
              <MemberActions userId={member.id} name={member.name} isSelf={member.id === admin.id} />
            </li>
          ))}
        </ul>
      </Card>

      {guests.length > 0 && (
        <Card aria-labelledby="guests">
          <h2 id="guests" className="text-xl font-semibold">
            {t("guests")}
          </h2>
          <p className="text-text-muted">{t("guestsHint")}</p>
          <dl className="grid grid-cols-3 gap-2">
            {(
              [
                [String(summary.total), t("beta.total", { count: summary.total })],
                [String(summary.active), t("beta.active")],
                [
                  summary.veterans > 0
                    ? t("beta.retainedValue", { retained: summary.retained, veterans: summary.veterans })
                    : "–",
                  t("beta.retained"),
                ],
              ] as const
            ).map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse justify-end rounded-2xl bg-surface-muted px-3 py-2">
                <dt className="text-xs leading-snug text-text-muted">{label}</dt>
                <dd className="text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-primary" />
              {t("beta.legendLogged")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-surface-muted ring-1 ring-border" />
              {t("beta.legendEmpty")}
            </span>
            <span>{t("beta.legendWindow")}</span>
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {guests.map((guest) => {
              const activity = activities.get(guest.id)!;
              const detail = details.get(guest.id)!;
              const [pillClass, pillText] = statusPill(activity);
              const pill = (
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${pillClass}`}>
                  {pillText}
                </span>
              );
              const joined = (
                <span className="text-sm text-text-muted">{t("beta.joined", { days: activity.joinedDaysAgo })}</span>
              );
              const seen = detail.lastSeen ? dayWhen(todayIso(detail.lastSeen)) : null;
              const mainWay = detail.entries[0];
              return (
                <BetaGuestRow
                  key={guest.id}
                  name={guest.name}
                  openLabel={t("beta.openLabel", { name: guest.name })}
                  openText={t("beta.open")}
                  closeLabel={t("beta.close")}
                  caption={
                    <span className="min-w-0 text-sm text-text-muted">
                      {seen ? t("beta.seen", { when: seen }) : t("beta.seenNever")}
                      {mainWay && ` · ${t("beta.mostly", { way: t(`beta.wayLower.${mainWay.way}`) })}`}
                    </span>
                  }
                  summary={
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-semibold">{guest.name}</span>
                          {joined}
                        </span>
                        {pill}
                      </div>
                      <BetaGuestStrip
                        days={activity.days}
                        label={t("beta.strip", { logged: activity.logged, possible: activity.possible })}
                      />
                    </>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {joined}
                    {pill}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <BetaGuestStrip
                      days={activity.days}
                      label={t("beta.strip", { logged: activity.logged, possible: activity.possible })}
                    />
                    <p className="text-xs text-text-muted tabular-nums">
                      {t("beta.stripCaption", { logged: activity.logged, possible: activity.possible })}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2">
                    {(
                      [
                        [t("beta.lastSeen"), seen ?? t("beta.never")],
                        [t("beta.lastMeal"), activity.lastLogged ? dayWhen(activity.lastLogged) : t("beta.never")],
                      ] as const
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex flex-col-reverse justify-end rounded-2xl bg-surface-muted px-3 py-2"
                      >
                        <dt className="text-xs text-text-muted">{label}</dt>
                        <dd className="font-bold first-letter:uppercase">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <section aria-labelledby={`ways-${guest.id}`} className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id={`ways-${guest.id}`} className="font-semibold">
                        {t("beta.ways")}
                      </h3>
                      {detail.entryCount > 0 && (
                        <span className="text-xs text-text-muted tabular-nums">
                          {t("beta.waysCount", { count: detail.entryCount })}
                        </span>
                      )}
                    </div>
                    {detail.entries.length === 0 ? (
                      <p className="text-sm text-text-muted">{t("beta.waysNone")}</p>
                    ) : (
                      <>
                        <span
                          role="img"
                          aria-label={detail.entries
                            .map((entry) => `${t(`beta.way.${entry.way}`)} ${entry.percent} %`)
                            .join(", ")}
                          className="flex h-3 gap-0.5 overflow-hidden rounded-full"
                        >
                          {detail.entries.map((entry, index) => (
                            <span
                              key={entry.way}
                              className={WAY_SHADES[index]}
                              style={{ width: `${entry.percent}%` }}
                            />
                          ))}
                        </span>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                          {detail.entries.map((entry, index) => (
                            <li key={entry.way} className="flex items-center gap-1.5">
                              <span className={`size-2.5 shrink-0 rounded-[3px] ${WAY_SHADES[index]}`} />
                              <span className="min-w-0 flex-1">{t(`beta.way.${entry.way}`)}</span>
                              <span className="font-semibold tabular-nums">{entry.percent} %</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                  <section aria-labelledby={`features-${guest.id}`} className="flex flex-col">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id={`features-${guest.id}`} className="font-semibold">
                        {t("beta.features")}
                      </h3>
                      <span className="text-xs text-text-muted">{t("beta.featuresWindow")}</span>
                    </div>
                    <ul className="flex flex-col divide-y divide-border">
                      {GUEST_FEATURES.map((feature) => {
                        const used = detail.features[feature];
                        return (
                          <li key={feature} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span>{t(`beta.feature.${feature}`)}</span>
                            <span className={used > 0 ? "font-semibold tabular-nums" : "text-text-muted"}>
                              {used > 0 ? t(`beta.featureCount.${feature}`, { count: used }) : t("beta.never")}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    <li className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5">
                      <Icon name={detail.device === "computer" ? "chart" : "phone"} size={16} />
                      {detail.device ? t(`beta.device.${detail.device}`) : t("beta.deviceUnknown")}
                    </li>
                    <li
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                        detail.reminders
                          ? "bg-primary-soft font-semibold text-primary"
                          : "bg-surface-muted text-text-muted"
                      }`}
                    >
                      <Icon name="bell" size={16} />
                      {detail.reminders ? t("beta.remindersOn") : t("beta.remindersOff")}
                    </li>
                    <li className="rounded-full bg-surface-muted px-3 py-1.5 tabular-nums">
                      {t("beta.aiMonth", { cost: formatUsd(format, costs.get(guest.id) ?? 0) })}
                    </li>
                  </ul>
                  <details className="group border-t border-border">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">
                      {t("beta.manage")}
                    </summary>
                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-sm text-text-muted">{guest.email}</span>
                      <MemberActions userId={guest.id} name={guest.name} isSelf={false} guest />
                    </div>
                  </details>
                </BetaGuestRow>
              );
            })}
          </ul>
          <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text-muted tabular-nums">
            <span className="block font-semibold text-text">
              {t("aiThisMonth", {
                spent: formatUsd(format, ai.spentUsdMicros),
                budget: formatUsd(format, ai.budgetUsd * 1_000_000),
              })}
            </span>
            {t("aiAllAccounts")}
          </p>
        </Card>
      )}

      <Card aria-labelledby="invite">
        <h2 id="invite" className="text-xl font-semibold">
          {t("invite")}
        </h2>
        <InviteForm />
        {invites.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">{t("pending")}</h3>
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-2"
                >
                  <span>
                    {invite.label} · {invite.separateHousehold ? t("guestRole") : t(`role.${invite.role ?? "member"}`)}{" "}
                    ·{" "}
                    <span className="text-sm text-text-muted">
                      {t("expires", { date: format.dateTime(invite.expiresAt, { dateStyle: "medium" }) })}
                    </span>
                  </span>
                  <form action={revokeInviteAction.bind(null, invite.id)}>
                    <button type="submit" className={buttonClass("ghost", "min-h-10 px-3 text-sm")}>
                      {t("revoke")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card aria-labelledby="demo">
        <h2 id="demo" className="text-xl font-semibold">
          {t("demo")}
        </h2>
        <DemoAccount
          email={DEMO_EMAIL}
          createdOn={demo ? format.dateTime(demo.createdAt, { dateStyle: "medium" }) : null}
        />
      </Card>

      <Card aria-labelledby="ai">
        <h2 id="ai" className="text-xl font-semibold">
          {t("ai")}
        </h2>
        <p className="text-text-muted">{t("aiHint")}</p>
        <Link href="/admin/ai" className={buttonClass("secondary")}>
          {t("aiOpen")}
        </Link>
      </Card>

      <Card aria-labelledby="push">
        <h2 id="push" className="text-xl font-semibold">
          {t("push")}
        </h2>
        {vapidPublicKey() ? <p>{t("pushReady")}</p> : <VapidKeys />}
        <p className="text-sm text-text-muted">{t("pushSchedule")}</p>
      </Card>

      <Card aria-labelledby="floors">
        <h2 id="floors" className="text-xl font-semibold">
          {t("floors")}
        </h2>
        <FloorsForm floors={floors} />
      </Card>
    </Columns>
  );
}
