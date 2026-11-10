"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SegmentedPill } from "@/ui/segmented";

const LABELS = { fr: "Français", en: "English" } as const;

/** Même sélecteur que le thème : la pastille glisse tout de suite, la page suit dans la langue choisie. */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const [chosen, setChosen] = useState(locale);

  return (
    <div className="flex flex-col gap-2">
      <p id="language-label" className="mb-1 text-sm font-semibold text-text-muted">
        {t("label")}
      </p>
      <nav
        aria-labelledby="language-label"
        className="relative grid auto-cols-fr grid-flow-col rounded-full bg-surface-muted p-1"
      >
        <SegmentedPill
          count={routing.locales.length}
          index={Math.max(0, routing.locales.indexOf(chosen as (typeof routing.locales)[number]))}
        />
        {routing.locales.map((value) => (
          <Link
            key={value}
            href={pathname}
            locale={value}
            lang={value}
            onClick={() => setChosen(value)}
            aria-current={value === locale ? "true" : undefined}
            className={`relative flex min-h-12 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors duration-200 ${
              value === chosen ? "text-on-primary" : ""
            }`}
          >
            {LABELS[value]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
