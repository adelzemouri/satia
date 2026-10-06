import { Bone, KitchenTabsBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette du menu : onglets Cuisine, titre, raccourcis (courses, frigo, partage), semaine et jours. */
export default function PlanLoading() {
  return (
    <SkeletonPage>
      <KitchenTabsBone />
      <TitleBone className="w-1/2" />
      <Bone className="h-5 w-4/5" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <Bone key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Bone className="size-12 rounded-full" />
        <Bone className="h-6 w-40" />
        <Bone className="size-12 rounded-full" />
      </div>
      {[0, 1, 2].map((index) => (
        <SkeletonCard key={index}>
          <Bone className="h-5 w-32" />
          <Bone className="h-4 w-3/5" />
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
