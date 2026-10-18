"use client";

import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";
import { haptic } from "@/ui/motion";

import { AddCamera } from "./add-camera";

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
    sections: ["/coach", "/fasting", "/treatment", "/foods", "/admin"],
  },
];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if (tab.href === "/" && pathname === "/") return true;
  return [...(tab.href === "/" ? [] : [tab.href]), ...(tab.sections ?? [])].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/** Barre de navigation inférieure ; le + central ouvre l'appareil photo, avec les autres façons d'ajouter un repas. */
export function BottomNav({ ai }: { ai: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [cameraOpen, setCameraOpen] = useState(false);
  // Pendant l'onboarding, on va au bout avant de pouvoir partir ailleurs dans l'app.
  if (pathname === "/onboarding" || pathname.startsWith("/profile/goals/")) return null;
  return (
    <>
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
                  <button
                    type="button"
                    onClick={() => {
                      haptic();
                      setCameraOpen(true);
                    }}
                    aria-haspopup="dialog"
                    aria-label={t("addMeal")}
                    className="-mt-3 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/30 transition-transform duration-[120ms] ease-out-strong active:scale-[0.94]"
                  >
                    <Icon name="plus" size={26} />
                  </button>
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
      {cameraOpen && <AddCamera ai={ai} onClose={() => setCameraOpen(false)} />}
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
