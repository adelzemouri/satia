import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/ui/button";

export default function NotFoundPage() {
  const t = useTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("body")}</p>
      <Link href="/" className={buttonClass()}>
        {t("home")}
      </Link>
    </main>
  );
}
