"use client";

import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

import { AddFan } from "./add-fan";

type TabKey = "home" | "kitchen" | "add" | "progress" | "profile";

/**
 * Quatre onglets et le + d'ajout au centre. Les pages secondaires allument l'onglet
 * dont elles dépendent (le journal sous « Accueil », le menu sous « Cuisine »…).
 */
const TABS: { href: string; key: TabKey; icon: keyof typeof ICONS; sections?: string[] }[] = [
  { href: "/", key: "home", icon: "home", sections: ["/journal"] },
  {
    href: "/recipes",
    key: "kitchen",
    icon: "book",
    sections: ["/plan", "/meals", "/shopping", "/fridge", "/family"],
  },
  { href: "/add", key: "add", icon: "plus", sections: ["/scan"] },
  {
    href: "/progress",
    key: "progress",
    icon: "chart",
    sections: ["/weight", "/body", "/activity", "/training", "/quality", "/metabolism"],
  },
  {
    href: "/profile",
    key: "profile",
    icon: "profile",
    sections: ["/coach", "/fasting", "/treatment", "/foods", "/containers", "/dictionary", "/admin"],
  },
];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if (tab.href === "/" && pathname === "/") return true;
  return [...(tab.href === "/" ? [] : [tab.href]), ...(tab.sections ?? [])].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/** Barre de navigation inférieure ; le + central ouvre en éventail les façons d'ajouter un repas. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // L'éventail du + est ouvert pour la page où on l'a ouvert : changer de page le referme.
  const [fanPath, setFanPath] = useState<string | null>(null);
  const fanOpen = fanPath === pathname;
  const setFanOpen = useCallback((open: boolean) => setFanPath(open ? pathname : null), [pathname]);
  // Pendant l'onboarding, on va au bout avant de pouvoir partir ailleurs dans l'app.
  if (pathname === "/onboarding") return null;
  return (
    <>
      {/* Fond flouté sous l'éventail : on lit mieux les actions, et un toucher dessus le referme. */}
      <div
        aria-hidden="true"
        onClick={() => setFanOpen(false)}
        className={`fixed inset-0 z-10 bg-bg/70 backdrop-blur-[3px] transition-opacity duration-200 lg:hidden ${fanOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <nav
        aria-label={t("main")}
        style={{ viewTransitionName: "bottom-nav" }}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            if (tab.key === "add")
              return (
                <li key={tab.key} className="flex items-center justify-center">
                  <AddFan open={fanOpen} onOpenChange={setFanOpen} />
                </li>
              );
            return (
              <li key={tab.key} className="flex justify-center">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs ${
                    active ? "font-bold text-primary" : "font-semibold text-text-muted"
                  }`}
                >
                  <TabContent icon={tab.icon} label={t(tab.key)} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/**
 * Contenu d'un onglet : dès le clic, l'onglet s'allume et une barre s'anime en attendant la
 * page, pour que la navigation se voie même quand le serveur met un peu de temps à répondre.
 */
function TabContent({ icon, label }: { icon: keyof typeof ICONS; label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary ${pending ? "animate-pulse" : "hidden"}`}
      />
      <span className={pending ? "text-primary" : ""}>
        <Icon name={icon} size={24} />
      </span>
      <span className={pending ? "text-primary" : ""}>{label}</span>
    </>
  );
}
