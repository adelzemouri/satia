import { Bone, KitchenTabsBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette des recettes : onglets Cuisine, titre, recherche et filtres, puis la grille de vignettes. */
export default function RecipesLoading() {
  return (
    <SkeletonPage wide>
      <KitchenTabsBone />
      <TitleBone className="w-1/2 lg:w-48" />
      <Bone className="h-5 w-4/5 lg:w-2/3" />
      <Bone className="h-12 w-40 rounded-full" />
      <div className="flex flex-col gap-4">
        <Bone className="h-12 w-full rounded-full" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4].map((index) => (
            <Bone key={index} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <div key={index} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface">
              <Bone className="aspect-[4/3] w-full rounded-none" />
              <div className="flex flex-col gap-2 px-3 py-2">
                <Bone className="h-4 w-4/5" />
                <Bone className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
