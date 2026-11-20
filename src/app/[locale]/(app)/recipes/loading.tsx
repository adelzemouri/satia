import { Bone, IntroBone, KitchenTabsBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette des recettes : onglets Cuisine, titre, présentation et « Nouvelle recette » (à droite
 * du titre sur ordinateur), recherche et filtres (sur une ligne sur ordinateur), puis la grille de
 * vignettes avec leur étoile, leur nom sur deux lignes et leurs calories.
 */
export default function RecipesLoading() {
  return (
    <SkeletonPage wide>
      <KitchenTabsBone />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-x-6 lg:gap-y-2">
        <TitleBone className="w-40" />
        <div className="lg:col-start-1 lg:row-start-2">
          <IntroBone className="lg:w-[28rem]" />
        </div>
        <Bone className="h-12 w-44 rounded-full lg:col-start-2 lg:row-start-1" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-3 lg:py-3">
        <Bone className="h-12 w-full rounded-full lg:w-72 lg:shrink-0" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 lg:mx-0 lg:px-0">
          {["w-20", "w-28", "w-24", "w-20", "w-24", "w-24", "w-28", "w-24"].map((width, index) => (
            <Bone key={index} className={`h-11 shrink-0 rounded-full ${width}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
          <div key={index} className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface">
            <Bone className="aspect-[4/3] w-full rounded-none" />
            <span className="absolute end-2 top-2 size-8 rounded-full bg-surface/90" />
            <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
              <Bone className="h-4 w-11/12" />
              <Bone className="h-4 w-3/5" />
              <Bone className="mt-1 h-3.5 w-4/5" />
              <Bone className="h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
