import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { revokeInviteAction } from "@/features/admin/actions";
import { FloorsForm } from "@/features/admin/floors-form";
import { InviteForm } from "@/features/admin/invite-form";
import { MemberActions } from "@/features/admin/member-actions";
import { VapidKeys } from "@/features/admin/vapid-keys";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { listMembers, listPendingInvites } from "@/server/accounts";
import { vapidPublicKey } from "@/server/notifications";
import { requireAdmin } from "@/server/session";
import { getCalorieFloors } from "@/server/settings";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const admin = await requireAdmin(locale);
  const [members, invites, floors] = await Promise.all([
    listMembers(admin.householdId),
    listPendingInvites(admin.householdId),
    getCalorieFloors(),
  ]);
  const t = await getTranslations("admin");
  const format = await getFormatter();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>

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
              <MemberActions userId={member.id} name={member.name} isSelf={member.id === admin.id} />
            </li>
          ))}
        </ul>
      </Card>

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
                    {invite.label} · {t(`role.${invite.role ?? "member"}`)} ·{" "}
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
