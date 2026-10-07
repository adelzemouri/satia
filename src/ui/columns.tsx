import type { ReactNode } from "react";

/**
 * Page en cartes : une colonne sur téléphone, deux sur ordinateur (à partir de 1024 px). Les
 * cartes (`section`, ou tout bloc marqué `data-col`) se répartissent dans les colonnes, dans
 * l'ordre ; le reste (titre, introduction, onglets, mentions) occupe toute la largeur.
 */
export function Columns({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div data-wide className={`desktop-columns flex flex-col gap-6 ${className}`}>
      {children}
    </div>
  );
}
