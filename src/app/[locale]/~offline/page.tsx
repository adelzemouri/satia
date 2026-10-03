import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { use } from "react";

import { toLocale } from "@/i18n/routing";

export default function OfflinePage({ params }: PageProps<"/[locale]/~offline">) {
  const { locale } = use(params);
  setRequestLocale(toLocale(locale));
  const t = useTranslations("offline");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p>{t("body")}</p>
    </main>
  );
}
