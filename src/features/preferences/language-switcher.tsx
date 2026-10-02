"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS = { fr: "Français", en: "English" } as const;

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex gap-2">
      {routing.locales.map((value) => (
        <Link
          key={value}
          href={pathname}
          locale={value}
          lang={value}
          aria-current={value === locale ? "true" : undefined}
          className="flex min-h-12 items-center rounded-full border border-border px-4 text-sm font-medium aria-[current]:bg-primary-soft"
        >
          {LABELS[value]}
        </Link>
      ))}
    </nav>
  );
}
