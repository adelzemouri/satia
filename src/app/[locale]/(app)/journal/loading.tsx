import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/** Squelette du journal : titre, semaine, bilan du jour, puis une carte par repas. */
export default function JournalLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-9 w-36 rounded-2xl" />
        <Bone className="size-12 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Bone key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
      <SkeletonCard>
        <Bone className="h-6 w-32" />
        <Bone className="h-5 w-40" />
        <Bone className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Bone className="h-4 w-16" />
              <Bone className="h-2 w-full rounded-full" />
              <Bone className="h-4 w-14" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      {[0, 1].map((index) => (
        <SkeletonCard key={index}>
          <div className="flex items-center justify-between">
            <Bone className="h-6 w-36" />
            <Bone className="h-5 w-20" />
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="flex min-h-12 items-center justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-5 w-3/5" />
                <Bone className="h-4 w-2/5" />
              </div>
              <Bone className="h-5 w-16" />
            </div>
          ))}
          <Bone className="h-12 w-36 rounded-full" />
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
