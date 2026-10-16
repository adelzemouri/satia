import { Bone, KitchenTabsBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette du menu : onglets Cuisine, titre, raccourcis (courses, frigo, partage), semaine et jours. */
export default function PlanLoading() {
  return (
    <SkeletonPage wide className="desktop-columns">
      <KitchenTabsBone />
      <TitleBone className="w-1/2" />
      <Bone className="h-5 w-4/5" />
      <div className="grid grid-cols-3 gap-2 lg:flex">
        {[0, 1, 2].map((index) => (
          <Bone key={index} className="h-20 rounded-2xl lg:h-12 lg:w-44" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Bone className="size-12 rounded-full" />
        <Bone className="h-6 w-40" />
        <Bone className="size-12 rounded-full" />
      </div>
      <div className="hidden gap-2 lg:grid lg:grid-cols-[6rem_repeat(7,minmax(0,1fr))]">
        <span />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Bone key={index} className="h-5 w-16" />
        ))}
        {[0, 1].map((row) => [
          <Bone key={`label-${row}`} className="h-5 w-16 self-center" />,
          ...[0, 1, 2, 3, 4, 5, 6].map((index) => <Bone key={`${row}-${index}`} className="h-24 rounded-2xl" />),
        ])}
      </div>
      <div data-col className="flex flex-col gap-3 lg:hidden">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index}>
            <Bone className="h-5 w-32" />
            <Bone className="h-4 w-3/5" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="lg:hidden">
        <Bone className="h-6 w-1/3" />
        <Bone className="h-12 w-full rounded-2xl" />
        <Bone className="h-12 w-full rounded-full" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
