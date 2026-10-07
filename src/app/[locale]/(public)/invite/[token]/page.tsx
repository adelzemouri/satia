import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db/client";
import { households } from "@/db/schema";
import { InviteForm } from "@/features/auth/invite-form";
import { toLocale } from "@/i18n/routing";
import { findValidLink } from "@/server/accounts";
import { Alert } from "@/ui/alert";
import { AuthShell } from "@/ui/page-shell";

export default async function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(toLocale(locale));
  const t = await getTranslations("invite");
  const link = await findValidLink(token, "invite");
  if (!link) {
    return (
      <AuthShell title={t("expiredTitle")}>
        <Alert>{t("invalid")}</Alert>
      </AuthShell>
    );
  }
  const [household] = link.separateHousehold
    ? []
    : await db().select().from(households).where(eq(households.id, link.householdId));
  const title = link.separateHousehold ? t("titleSeparate") : t("title", { household: household?.name ?? "" });
  return (
    <AuthShell title={title} intro={t("intro")}>
      <InviteForm token={token} defaultName={link.label ?? ""} />
    </AuthShell>
  );
}
