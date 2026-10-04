import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/** Squelette du journal : le jour, la barre des calories, puis une carte par repas. */
export default function JournalLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center justify-between gap-3">
        <Bone className="size-11 rounded-full" />
        <Bone className="h-8 w-1/2 rounded-2xl" />
        <Bone className="size-11 rounded-full" />
      </div>
      <SkeletonCard>
        <Bone className="h-5 w-2/3" />
        <Bone className="h-3 w-full rounded-full" />
      </SkeletonCard>
      {[0, 1, 2, 3].map((index) => (
        <SkeletonCard key={index}>
          <div className="flex items-center justify-between">
            <Bone className="h-6 w-1/3" />
            <Bone className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-3">
            <Bone className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-4 w-3/5" />
              <Bone className="h-3 w-2/5" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
