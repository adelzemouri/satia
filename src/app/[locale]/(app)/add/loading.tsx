import { Bone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette de l'ajout : titre et repas, le grand champ « Qu'as-tu mangé ? », la rangée photo,
 * voix et code-barres, Mes repas, puis les listes (récents, favoris, les miens).
 */
export default function AddLoading() {
  return (
    <SkeletonPage wide>
      <div className="flex items-center justify-between gap-3">
        <TitleBone className="w-32" />
        <Bone className="h-12 w-36 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Bone className="h-16 w-full rounded-2xl" />
        <Bone className="h-4 w-3/4" />
      </div>
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <Bone key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
          <div className="flex flex-col rounded-[var(--radius-card)] bg-surface px-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex min-h-16 items-center gap-3 py-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Bone className="h-5 w-3/5" />
                  <Bone className="h-4 w-2/5" />
                </div>
                <Bone className="size-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <Bone className="h-[52px] w-full rounded-full" />
          <div className="flex flex-col rounded-[var(--radius-card)] bg-surface px-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex min-h-16 items-center gap-3 py-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Bone className="h-5 w-3/5" />
                  <Bone className="h-4 w-2/5" />
                </div>
                <Bone className="size-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
