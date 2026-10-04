import { type ReactNode, ViewTransition } from "react";

/** Glissement selon le sens de la navigation (onglets, liens de hub, retour). */
const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * Recréé à chaque navigation : la nouvelle page arrive en fondu léger, et glisse quand le lien
 * indique un sens (vers la droite en avançant, vers la gauche en revenant).
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
      <div className="page-in flex flex-col gap-6">{children}</div>
    </ViewTransition>
  );
}
