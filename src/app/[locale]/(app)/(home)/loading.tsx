import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/** Squelette de l'accueil : bonjour, anneau des calories, repas du jour, puis idées de recettes. */
export default function HomeLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Bone className="h-5 w-40" />
          <Bone className="h-9 w-56 rounded-2xl" />
        </div>
        <Bone className="size-12 rounded-full" />
      </div>
      <div className="-mt-3 flex flex-col gap-2">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-2/3" />
      </div>
      <SkeletonCard>
        <div className="flex items-center gap-5">
          <div className="size-36 shrink-0 animate-pulse rounded-full border-[12px] border-surface-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-4 w-20" />
            <Bone className="h-6 w-28" />
            <Bone className="mt-2 h-4 w-24" />
            <Bone className="h-6 w-28" />
          </div>
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
      </SkeletonCard>
      <SkeletonCard>
        <Bone className="h-6 w-40" />
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex min-h-16 items-center justify-between gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-5 w-32" />
              <Bone className="h-4 w-4/5" />
            </div>
            <Bone className="size-12 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </SkeletonPage>
  );
}
