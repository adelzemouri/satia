import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

const TABS = [
  { href: "/recipes", key: "recipes" },
  { href: "/plan", key: "menu" },
  { href: "/meals", key: "meals" },
] as const;

/**
 * Onglets de l'espace « Cuisine » : les recettes, le menu du foyer (et ses courses), et les repas
 * enregistrés. L'onglet « Cuisine » de la barre du bas mène ici ; chaque page garde son adresse.
 */
export async function KitchenTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  const t = await getTranslations("kitchen");
  return (
    <nav aria-label={t("title")} className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1 lg:max-w-md">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-semibold transition ${
            tab.key === current ? "bg-primary text-on-primary" : "text-text hover:bg-surface"
          }`}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
