/**
 * Pastille d'un sélecteur à plusieurs choix de même largeur (thème, langue) : elle glisse d'un
 * choix à l'autre au lieu de sauter. À placer en premier enfant d'un conteneur `relative` en
 * grille, avec `p-1` ; les choix passent au-dessus (`relative`).
 */
export function SegmentedPill({ count, index }: { count: number; index: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1 left-1 rounded-full bg-primary transition-transform duration-[250ms] ease-out-strong"
      style={{ width: `calc((100% - 0.5rem) / ${count})`, transform: `translateX(${index * 100}%)` }}
    />
  );
}
