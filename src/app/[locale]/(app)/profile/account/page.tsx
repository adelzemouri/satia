import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { DeleteAccountForm } from "@/features/profile/delete-account-form";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

/** Mes données : export complet, puis, à part et en bas, la suppression du compte. */
export default async function AccountPage({ params }: PageProps<"/[locale]/profile/account">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("profile");

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("data")}</h1>
      <Card aria-labelledby="export">
        <h2 id="export" className="text-xl font-semibold">
          {t("exportTitle")}
        </h2>
        <p className="text-text-muted">{t("exportHint")}</p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/me/export?format=json" className={buttonClass("secondary")} download>
            {t("exportJson")}
          </a>
          <a href="/api/me/export?format=csv" className={buttonClass("secondary")} download>
            {t("exportCsv")}
          </a>
        </div>
      </Card>
      <Card aria-labelledby="delete">
        <h2 id="delete" className="text-xl font-semibold">
          {t("deleteTitle")}
        </h2>
        <DeleteAccountForm email={user.email} />
      </Card>
      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
