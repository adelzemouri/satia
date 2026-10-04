import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/** Squelette de « Progrès » : le ressenti du jour, son historique, puis la liste des rubriques. */
export default function ProgressLoading() {
  return (
    <SkeletonPage>
      <Bone className="h-9 w-1/2 rounded-2xl" />
      <SkeletonCard>
        <Bone className="h-6 w-1/2" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Bone key={index} className="size-11 rounded-full" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <Bone className="h-6 w-1/3" />
        <Bone className="h-24 w-full rounded-2xl" />
      </SkeletonCard>
      <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-surface p-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex min-h-16 items-center gap-4 px-2">
            <Bone className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-4 w-2/5" />
              <Bone className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
