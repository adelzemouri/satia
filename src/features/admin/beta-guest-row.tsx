"use client";

import { type ReactNode, useState } from "react";

import { Icon } from "@/ui/icon";
import { Sheet } from "@/ui/sheet";

/**
 * Ligne d'un invité de la bêta : toute la ligne ouvre sa fiche (panneau du bas sur téléphone,
 * fenêtre centrée sur ordinateur). Le contenu, rendu côté serveur, arrive tout prêt.
 */
export function BetaGuestRow({
  name,
  openLabel,
  openText,
  closeLabel,
  summary,
  caption,
  children,
}: {
  name: string;
  openLabel: string;
  openText: string;
  closeLabel: string;
  summary: ReactNode;
  caption: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    // Le bouton s'étend sur toute la ligne (calque `after:`) : on touche n'importe où pour ouvrir.
    <li className="group relative flex flex-col gap-2 py-3">
      {summary}
      <div className="flex items-center justify-between gap-3">
        {caption}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={openLabel}
          aria-haspopup="dialog"
          className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary after:absolute after:inset-0 after:content-['']"
        >
          {openText}
          <span className="flex transition-transform duration-150 [@media(hover:hover)]:group-hover:translate-x-0.5">
            <Icon name="right" size={16} />
          </span>
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={name} closeLabel={closeLabel} tall>
        {children}
      </Sheet>
    </li>
  );
}
