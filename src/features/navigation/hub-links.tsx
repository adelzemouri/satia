import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

export type HubLink = {
  href: ComponentProps<typeof Link>["href"];
  icon: keyof typeof ICONS;
  label: string;
  hint?: string;
  /** Réglage en cours, affiché à droite avant le chevron (« 2 L », « 16:8 »). */
  value?: ReactNode;
  /** Ligne masquée quand Pommelia est ouverte depuis son icône (installation déjà faite). */
  hideWhenInstalled?: boolean;
};

/**
 * Liste de pages secondaires, regroupées sous un onglet (« Progrès », « Moi »).
 * Chaque ligne occupe toute la largeur de la carte : la surbrillance touche ses
 * bords (arrondis par la carte), et les séparateurs démarrent après l'icône.
 */
export function HubLinks({ label, links }: { label: string; links: HubLink[] }) {
  return (
    <nav aria-label={label} className="overflow-hidden rounded-[var(--radius-card)] bg-surface">
      <ul className="flex flex-col">
        {links.map((link) => (
          <li
            key={link.label}
            className={link.hideWhenInstalled ? "[@media(display-mode:standalone)]:hidden" : undefined}
          >
            <Link
              href={link.href}
              className="relative flex min-h-16 items-center gap-4 px-5 py-2 transition-colors before:absolute before:start-[4.75rem] before:end-0 before:top-0 before:h-px hover:bg-surface-muted hover:before:opacity-0 focus-visible:bg-surface-muted focus-visible:outline-offset-[-3px] focus-visible:before:opacity-0 in-[li+li]:before:bg-border in-[li:has(:focus-visible)+li]:before:opacity-0 in-[li:hover+li]:before:opacity-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name={link.icon} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{link.label}</span>
                {link.hint && <span className="truncate text-sm text-text-muted">{link.hint}</span>}
              </span>
              {link.value && <span className="shrink-0 text-right text-text-muted">{link.value}</span>}
              <span className="text-text-muted">
                <Icon name="right" size={20} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
