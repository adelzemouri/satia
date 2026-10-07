import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

export type HubLink = {
  href: ComponentProps<typeof Link>["href"];
  icon: keyof typeof ICONS;
  label: string;
  hint?: string;
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
          <li key={link.label}>
            <Link
              href={link.href}
              className="relative flex min-h-16 items-center gap-4 px-5 py-2 transition-colors hover:bg-surface-muted hover:before:opacity-0 focus-visible:bg-surface-muted focus-visible:outline-offset-[-3px] focus-visible:before:opacity-0 in-[li+li]:before:absolute in-[li+li]:before:start-[4.75rem] in-[li+li]:before:end-0 in-[li+li]:before:top-0 in-[li+li]:before:h-px in-[li+li]:before:bg-border in-[li:has(:focus-visible)+li]:before:opacity-0 in-[li:hover+li]:before:opacity-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name={link.icon} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{link.label}</span>
                {link.hint && <span className="truncate text-sm text-text-muted">{link.hint}</span>}
              </span>
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
