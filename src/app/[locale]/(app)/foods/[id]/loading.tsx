import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/**
 * Squelette de la fiche d'un aliment, à la forme d'une fiche recette (le chemin le plus courant,
 * depuis Recettes, l'accueil ou le menu) : photo, source, nom et étoile, ajout au journal et au
 * menu, Pépin, puis les étiquettes ; ingrédients, préparation et valeurs nutritionnelles ensuite.
 * Sur ordinateur, les mêmes deux colonnes que la fiche (photo et nom à gauche, le détail à droite).
 */
export default function FoodLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <Bone className="-mx-4 aspect-[4/3] rounded-none sm:mx-0 sm:rounded-[var(--radius-card)]" />
        <div className="flex items-start gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-8 w-full rounded-2xl" />
            <Bone className="h-8 w-1/2 rounded-2xl" />
          </div>
          <Bone className="mt-1 size-12 shrink-0 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Bone className="h-12 flex-1 rounded-full" />
          <Bone className="h-12 flex-1 rounded-full" />
        </div>
        <Bone className="h-12 w-52 rounded-full" />
        <div className="flex flex-wrap gap-2">
          {["w-36", "w-20", "w-24", "w-28"].map((width) => (
            <Bone key={width} className={`h-9 rounded-full ${width}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-2 xl:items-start">
          <SkeletonCard className="gap-3">
            <Bone className="h-6 w-32" />
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex justify-between gap-3 py-1">
                <Bone className="h-4 w-1/2" />
                <Bone className="h-4 w-12" />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard className="gap-3">
            <Bone className="h-6 w-32" />
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-start gap-3">
                <Bone className="size-6 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Bone className="h-4 w-full" />
                  <Bone className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </SkeletonCard>
        </div>
        <SkeletonCard className="gap-3">
          <Bone className="h-6 w-48" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} className="flex justify-between gap-3 border-t border-border pt-3">
              <Bone className="h-4 w-24" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
