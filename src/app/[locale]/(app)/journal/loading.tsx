import { Bone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette du journal : titre, semaine et ses liens, bilan du jour, puis une carte par repas. */
export default function JournalLoading() {
  return (
    <SkeletonPage wide className="desktop-columns">
      <TitleBone className="w-36" />
      <div className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Bone key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
      <div className="-mt-2 flex min-h-11 items-center">
        <Bone className="h-4 w-36" />
      </div>
      <SkeletonCard tone="highlight">
        <div className="flex flex-col gap-1.5">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-36" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <Bone className="h-5 w-40" />
            <Bone className="h-5 w-28" />
          </div>
          <Bone className="h-3 w-full rounded-full" />
          <Bone className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Bone className="h-4 w-16" />
              <Bone className="h-2 w-full rounded-full" />
              <Bone className="h-4 w-14" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Bone className="h-4 w-20" />
              <Bone className="h-2 w-full rounded-full" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      {[0, 1, 2, 3].map((index) => (
        <SkeletonCard key={index}>
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-6 w-36" />
            <Bone className="h-5 w-16" />
          </div>
          <Bone className="h-5 w-3/5" />
          <Bone className="h-12 w-32 rounded-full" />
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
