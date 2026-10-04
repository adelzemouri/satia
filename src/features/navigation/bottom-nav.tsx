"use client";

import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

type TabKey = "home" | "journal" | "add" | "progress" | "profile";

/**
 * Quatre onglets et le bouton d'ajout au centre. Les pages secondaires allument l'onglet
 * dont elles dépendent (le poids sous « Progrès », le coach sous « Moi »…).
 */
const TABS: { href: string; key: TabKey; icon: keyof typeof ICONS; sections?: string[] }[] = [
  { href: "/", key: "home", icon: "home" },
  { href: "/journal", key: "journal", icon: "journal" },
  { href: "/add", key: "add", icon: "plus", sections: ["/scan"] },
  {
    href: "/progress",
    key: "progress",
    icon: "chart",
    sections: ["/weight", "/body", "/activity", "/training", "/week", "/quality", "/metabolism"],
  },
  {
    href: "/profile",
    key: "profile",
    icon: "profile",
    sections: [
      "/coach",
      "/family",
      "/plan",
      "/shopping",
      "/recipes",
      "/meals",
      "/fridge",
      "/fasting",
      "/treatment",
      "/foods",
      "/containers",
      "/dictionary",
      "/admin",
    ],
  },
];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if (tab.href === "/") return pathname === "/";
  return [tab.href, ...(tab.sections ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

/** Barre de navigation inférieure ; le bouton central ouvre l'ajout d'un aliment. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("main")}
      style={{ viewTransitionName: "bottom-nav" }}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const central = tab.key === "add";
          return (
            <li key={tab.key} className="flex justify-center">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={central ? t(tab.key) : undefined}
                className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs ${
                  active ? "font-bold text-primary" : "font-semibold text-text-muted"
                }`}
              >
                <TabContent icon={tab.icon} label={t(tab.key)} central={central} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Contenu d'un onglet : dès le clic, l'onglet s'allume et une barre s'anime en attendant la
 * page, pour que la navigation se voie même quand le serveur met un peu de temps à répondre.
 */
function TabContent({ icon, label, central }: { icon: keyof typeof ICONS; label: string; central: boolean }) {
  const { pending } = useLinkStatus();
  if (central) {
    // Bouton surélevé : la saisie d'un repas est l'action principale de l'app.
    return (
      <span
        className={`-mt-7 flex size-15 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 ${pending ? "animate-pulse" : ""}`}
      >
        <Icon name={icon} size={28} />
      </span>
    );
  }
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
