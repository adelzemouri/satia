import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/** Squelette de « Progrès » : le ressenti du jour (trois échelles), son historique, puis les rubriques. */
export default function ProgressLoading() {
  return (
    <SkeletonPage>
      <Bone className="h-9 w-40 rounded-2xl" />
      <SkeletonCard>
        <Bone className="h-6 w-1/2" />
        <Bone className="h-4 w-3/5" />
        {[0, 1, 2].map((scale) => (
          <div key={scale} className="flex flex-col gap-2">
            <Bone className="h-5 w-20" />
            <div className="flex justify-between">
              {[0, 1, 2, 3, 4].map((index) => (
                <Bone key={index} className="size-12 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </SkeletonCard>
      <SkeletonCard>
        <Bone className="h-6 w-2/3" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-24 w-full rounded-2xl" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
