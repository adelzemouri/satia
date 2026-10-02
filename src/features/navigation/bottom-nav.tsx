"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

const TABS: {
  href: string;
  key: "home" | "journal" | "add" | "training" | "weight" | "profile";
  icon: keyof typeof ICONS;
}[] = [
  { href: "/", key: "home", icon: "home" },
  { href: "/journal", key: "journal", icon: "journal" },
  { href: "/add", key: "add", icon: "plus" },
  { href: "/training", key: "training", icon: "dumbbell" },
  { href: "/weight", key: "weight", icon: "weight" },
  { href: "/profile", key: "profile", icon: "profile" },
];

/** Barre de navigation inférieure ; le bouton central ouvre l'ajout d'un aliment. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-6">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const central = tab.key === "add";
          return (
            <li key={tab.key} className="flex justify-center">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  active ? "text-primary" : "text-text-muted"
                }`}
              >
                {central ? (
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
                    <Icon name={tab.icon} size={26} />
                  </span>
                ) : (
                  <Icon name={tab.icon} />
                )}
                <span className={central ? "sr-only" : ""}>{t(tab.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
