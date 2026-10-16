import { Bone, HubLinksBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette de « Progrès », à la forme de la page : le poids d'abord, puis les rubriques.
 * Tableau de bord sur ordinateur (dépense, séances, pas).
 */
export default function ProgressLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-3 lg:items-start">
      <TitleBone className="w-40 lg:col-span-3" />
      <SkeletonCard className="lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-7 w-28" />
          <Bone className="h-4 w-20" />
        </div>
        <Bone className="h-9 w-40 rounded-2xl" />
        <Bone className="h-36 w-full rounded-2xl" />
      </SkeletonCard>
      <div className="lg:col-start-3 lg:row-span-3 lg:row-start-2">
        <HubLinksBone count={6} />
      </div>
      {[0, 1].map((index) => (
        <SkeletonCard key={index} className="max-lg:hidden">
          <Bone className="h-6 w-32" />
          <Bone className="h-9 w-28" />
          <Bone className="h-4 w-40" />
        </SkeletonCard>
      ))}
      <SkeletonCard className="max-lg:hidden lg:col-span-2">
        <Bone className="h-6 w-48" />
        <Bone className="h-36 w-full rounded-2xl" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
