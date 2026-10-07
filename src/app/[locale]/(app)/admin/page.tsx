import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { revokeInviteAction } from "@/features/admin/actions";
import { DemoAccount } from "@/features/admin/demo-account";
import { FloorsForm } from "@/features/admin/floors-form";
import { InviteForm } from "@/features/admin/invite-form";
import { formatUsd } from "@/features/admin/format-usd";
import { MemberActions } from "@/features/admin/member-actions";
import { VapidKeys } from "@/features/admin/vapid-keys";
import { Link } from "@/i18n/navigation";
import { DEMO_EMAIL } from "@/domain/demo";
import { toLocale } from "@/i18n/routing";
import { llmConfig } from "@/llm/config";
import { aiStatus } from "@/llm/guard";
import { currentMonthCostByUser } from "@/llm/usage";
import { listGuests, listMembers, listPendingInvites } from "@/server/accounts";
import { vapidPublicKey } from "@/server/notifications";
import { demoAccountStatus } from "@/server/demo";
import { requireAdmin } from "@/server/session";
import { getCalorieFloors } from "@/server/settings";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const admin = await requireAdmin(locale);
  const [members, guests, invites, floors, demo, costs, ai] = await Promise.all([
    listMembers(admin.householdId),
    listGuests(admin.householdId),
    listPendingInvites(admin.householdId),
    getCalorieFloors(),
    demoAccountStatus(),
    currentMonthCostByUser(),
    aiStatus(llmConfig()),
  ]);
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const monthCost = (userId: string) => t("monthCost", { cost: formatUsd(format, costs.get(userId) ?? 0) });

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>

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
          <ul className="flex flex-col divide-y divide-border">
            {guests.map((guest) => (
              <li key={guest.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{guest.name}</span>
                  <span className="text-sm text-text-muted">{guest.email}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="rounded-full bg-pomme-soft px-3 py-1">{t("guestRole")}</span>
                  {guest.twoFactorEnabled && (
                    <span className="rounded-full bg-primary-soft px-3 py-1">{t("twoFactor")}</span>
                  )}
                </div>
                <p className="text-sm text-text-muted tabular-nums">{monthCost(guest.id)}</p>
                <MemberActions userId={guest.id} name={guest.name} isSelf={false} guest />
              </li>
            ))}
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
    </>
  );
}
