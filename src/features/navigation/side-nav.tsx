"use client";

import { useEffect } from "react";
import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";

import { APP_NAME, COACH_NAME } from "@/config/app";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

type Item = { href: string; label: string; icon: keyof typeof ICONS; sections?: string[] };

/** Grand écran : à partir de cette largeur, la barre latérale remplace la barre du bas. */
const DESKTOP_QUERY = "(min-width: 64rem)";

function isActive(pathname: string, item: { href: string; sections?: string[] }): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.sections ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

/** Le raccourci « N » ne doit pas voler une lettre tapée dans un champ. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Navigation sur ordinateur : une barre latérale fixe, réduite aux icônes entre 1024 et 1279 px,
 * avec les libellés au-delà. Elle montre le journal et Pépin, rangés sous « Moi » sur téléphone.
 * Sous 1024 px elle disparaît et la barre du bas prend le relais, sans changement.
 */
export function SideNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "n" || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (!window.matchMedia(DESKTOP_QUERY).matches) return;
      event.preventDefault();
      router.push("/add");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (pathname === "/onboarding") return null;

  const items: Item[] = [
    { href: "/", label: t("nav.home"), icon: "home" },
    { href: "/journal", label: t("nav.journal"), icon: "journal" },
    {
      href: "/recipes",
      label: t("nav.kitchen"),
      icon: "book",
      sections: ["/plan", "/meals", "/shopping", "/fridge", "/family"],
    },
    {
      href: "/progress",
      label: t("nav.progress"),
      icon: "chart",
      sections: ["/weight", "/body", "/activity", "/training", "/quality", "/metabolism"],
    },
    { href: "/coach", label: COACH_NAME, icon: "chat" },
  ];
  const kitchen = [
    { href: "/recipes", label: t("kitchen.recipes") },
    { href: "/plan", label: t("kitchen.menu"), sections: ["/shopping", "/fridge", "/family"] },
    { href: "/meals", label: t("kitchen.meals") },
  ];
  const kitchenOpen = isActive(pathname, items[2]!);
  const profile: Item = {
    href: "/profile",
    label: t("nav.profile"),
    icon: "profile",
    sections: ["/fasting", "/treatment", "/foods", "/containers", "/dictionary", "/admin"],
  };
  const adding = isActive(pathname, { href: "/add", sections: ["/scan"] });

  return (
    <nav
      aria-label={t("nav.main")}
      style={{ viewTransitionName: "side-nav" }}
      className="fixed inset-y-0 left-0 z-10 hidden w-20 flex-col gap-1 bg-surface px-3 pt-6 pb-4 lg:flex xl:w-64"
    >
      <Link href="/" className="mb-5 flex items-center gap-3 self-center px-1 xl:self-stretch xl:px-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
        <img src="/icons/icon.svg" alt="" width={36} height={36} />
        <span className="sr-only font-display text-xl font-extrabold tracking-tight xl:not-sr-only">{APP_NAME}</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <SideLink item={item} active={isActive(pathname, item)} />
            {item.href === "/recipes" && kitchenOpen && (
              <ul className="mt-1 mb-2 hidden flex-col gap-0.5 pl-11 xl:flex">
                {kitchen.map((sub) => {
                  const active = isActive(pathname, sub);
                  return (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-9 items-center rounded-lg px-3 text-sm ${
                          active ? "font-bold text-primary" : "font-semibold text-text-muted hover:text-text"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="/add"
        aria-current={adding ? "page" : undefined}
        aria-keyshortcuts="n"
        title={t("nav.addMeal")}
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-3 font-bold text-on-primary shadow-lg shadow-primary/20 hover:brightness-110"
      >
        <Icon name="plus" size={22} />
        <span className="sr-only xl:not-sr-only">{t("nav.addMeal")}</span>
        <kbd aria-hidden="true" className="hidden rounded-md border border-current/60 px-1.5 text-xs xl:inline">
          N
        </kbd>
      </Link>
      <div className="mt-auto border-t border-border pt-3">
        <SideLink item={profile} active={isActive(pathname, profile)} />
      </div>
    </nav>
  );
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={`flex min-h-12 items-center justify-center gap-3 rounded-xl px-3 xl:justify-start ${
        active
          ? "bg-primary-soft font-bold text-primary"
          : "font-semibold text-text-muted hover:bg-surface-muted hover:text-text"
      }`}
    >
      <SideLinkContent item={item} />
    </Link>
  );
}

/** Le lien s'allume dès le clic, pour que la navigation se voie pendant que la page arrive. */
function SideLinkContent({ item }: { item: Item }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={pending ? "animate-pulse text-primary" : ""}>
        <Icon name={item.icon} size={22} />
      </span>
      <span className="sr-only xl:not-sr-only">{item.label}</span>
    </>
  );
}
