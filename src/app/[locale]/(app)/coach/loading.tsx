import { Bone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de Pépin : son portrait et son nom, le bilan de la semaine, puis la conversation. */
export default function CoachLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div className="flex items-center gap-4 lg:col-span-2">
        <Bone className="size-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <TitleBone className="w-28" />
          <Bone className="h-5 w-44" />
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:col-span-2">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-1/3" />
      </div>
      <SkeletonCard className="lg:col-start-2 lg:row-start-3">
        <Bone className="h-7 w-1/2" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
      </SkeletonCard>
      <SkeletonCard className="lg:col-start-1 lg:row-span-2 lg:row-start-3">
        <Bone className="h-7 w-2/5" />
        <Bone className="h-16 w-3/4 rounded-2xl" />
        <Bone className="h-12 w-2/3 self-end rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2].map((index) => (
            <Bone key={index} className="h-11 w-40 shrink-0 rounded-full" />
          ))}
        </div>
        <Bone className="h-24 w-full rounded-2xl" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
