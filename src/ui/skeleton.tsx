import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/** Bloc gris qui pulse à la place d'un contenu en cours de chargement. */
export function Bone({ className }: { className: string }) {
  // Coins arrondis par défaut, sauf si la forme est donnée (cercle d'un bouton, pilule…).
  const radius = /\brounded/.test(className) ? "" : "rounded-xl";
  return <div className={`animate-pulse bg-surface-muted ${radius} ${className}`} />;
}

/** Carte vide de la forme des cartes de l'app. */
export function SkeletonCard({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">{children}</div>;
}

/** Enveloppe d'un écran de chargement : annoncée aux lecteurs d'écran, puis la forme de la page. */
export async function SkeletonPage({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}
