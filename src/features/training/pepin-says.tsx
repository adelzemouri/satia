import type { ReactNode } from "react";

import { CoachAvatar } from "@/features/coach/coach-avatar";

/**
 * Bulle de Pépin dans l'espace Entraînement, même dessin que sur l'accueil. `soft` : fond rouge
 * pomme pâle, pour un conseil dans le fil de la séance. Le préfixe « Pépin dit : » est lu par les
 * lecteurs d'écran, l'avatar reste décoratif.
 */
export function PepinSays({
  children,
  says,
  size = 40,
  soft = false,
  className = "",
  live = false,
}: {
  children: ReactNode;
  says: string;
  size?: number;
  soft?: boolean;
  className?: string;
  /** Annonce les changements (consigne de l'exercice suivant, réponse au ressenti). */
  live?: boolean;
}) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <CoachAvatar size={size} />
      <p
        aria-live={live ? "polite" : undefined}
        className={`min-w-0 flex-1 rounded-2xl rounded-bl-md px-3.5 py-2.5 ${soft ? "bg-pomme-soft" : "bg-surface"}`}
      >
        <span className="sr-only">{says} </span>
        {children}
      </p>
    </div>
  );
}
