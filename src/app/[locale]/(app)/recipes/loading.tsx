import { Bone, SkeletonPage } from "@/ui/skeleton";

/** Squelette des recettes : les filtres puis la grille de vignettes. */
export default function RecipesLoading() {
  return (
    <SkeletonPage>
      <Bone className="h-9 w-1/2 rounded-2xl" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((index) => (
          <Bone key={index} className="h-10 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface">
            <Bone className="aspect-[4/3] w-full rounded-none" />
            <div className="flex flex-col gap-2 px-3 py-2">
              <Bone className="h-4 w-4/5" />
              <Bone className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
