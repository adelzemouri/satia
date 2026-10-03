import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

export type HubLink = {
  href: ComponentProps<typeof Link>["href"];
  icon: keyof typeof ICONS;
  label: string;
  hint?: string;
};

/** Liste de pages secondaires, regroupées sous un onglet (« Progrès », « Moi »). */
export function HubLinks({ label, links }: { label: string; links: HubLink[] }) {
  return (
    <nav aria-label={label} className="rounded-[var(--radius-card)] bg-surface px-2">
      <ul className="flex flex-col divide-y divide-border">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="flex min-h-16 items-center gap-4 rounded-2xl px-3 py-2 hover:bg-surface-muted"
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
