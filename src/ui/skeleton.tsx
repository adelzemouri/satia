import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/** Bloc gris qui pulse à la place d'un contenu en cours de chargement. */
export function Bone({ className }: { className: string }) {
  // Coins arrondis par défaut, sauf si la forme est donnée (cercle d'un bouton, pilule…).
  const radius = /\brounded/.test(className) ? "" : "rounded-xl";
  return <div className={`animate-pulse bg-surface-muted ${radius} ${className}`} />;
}

/** Anneau vide (anneau des calories, anneaux des repas et des jours). */
export function RingBone({ className }: { className: string }) {
  return <div className={`shrink-0 animate-pulse rounded-full border-surface-muted ${className}`} />;
}

/** Carte vide de la forme des cartes de l'app (même marge et même espacement que `Card`). */
export function SkeletonCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    // `data-col` : dans une page en colonnes (`Columns`), la carte se range dans une colonne.
    <div data-col className={`flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

/** Titre de page (police d'affichage, text-3xl). */
export function TitleBone({ className = "w-2/3" }: { className?: string }) {
  return <Bone className={`h-9 rounded-2xl ${className}`} />;
}

/** Liste de liens vers des pages secondaires, comme `HubLinks` (« Progrès », « Moi »). */
export function HubLinksBone({ count, hints = false }: { count: number; hints?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] bg-surface px-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-h-16 items-center gap-4 px-3 py-2">
          <Bone className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone className="h-5 w-2/5" />
            {hints && <Bone className="h-4 w-3/5" />}
          </div>
          <Bone className="size-5 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Onglets de l'espace « Cuisine » (recettes, menu, repas). */
export function KitchenTabsBone() {
  return <Bone className="h-[52px] w-full rounded-full lg:max-w-md" />;
}

/** Page de réglages : un titre, puis une carte de champs. */
export function FormPageBone({ fields = 3 }: { fields?: number }) {
  return (
    <>
      <TitleBone className="w-1/2" />
      <SkeletonCard>
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Bone className="h-5 w-32" />
            <Bone className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </SkeletonCard>
    </>
  );
}

/**
 * Enveloppe d'un écran de chargement : annoncée aux lecteurs d'écran, puis la forme de la page.
 * `wide` reprend le `data-wide` des pages qui s'étalent sur ordinateur (accueil, recettes, progrès),
 * et `className` leur grille, pour que le squelette ait déjà la largeur et les colonnes de la page.
 */
export async function SkeletonPage({
  children,
  wide = false,
  className = "",
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" data-wide={wide || undefined} className={`flex flex-col gap-6 ${className}`}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}
