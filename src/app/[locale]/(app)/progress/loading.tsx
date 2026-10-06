import { Bone, HubLinksBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette de « Progrès », à la forme de la page : le poids d'abord, puis le ressenti du jour
 * (une question à la fois), son historique et les rubriques. Deux colonnes sur ordinateur.
 */
export default function ProgressLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-2 lg:items-start">
      <TitleBone className="w-40 lg:col-span-2" />
      <SkeletonCard>
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-7 w-28" />
          <Bone className="h-4 w-20" />
        </div>
        <Bone className="h-9 w-40 rounded-2xl" />
        <Bone className="h-36 w-full rounded-2xl" />
      </SkeletonCard>
      <SkeletonCard>
        <Bone className="h-7 w-1/2" />
        <Bone className="h-4 w-4/5" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <Bone key={index} className="h-12 rounded-full" />
          ))}
        </div>
        <div className="flex justify-between gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <Bone key={index} className="size-14 rounded-2xl" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <div className="flex flex-col gap-1.5">
          <Bone className="h-7 w-2/3" />
          <Bone className="h-4 w-4/5" />
        </div>
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <Bone className="h-5 w-24" />
            <Bone className="h-20 w-full rounded-2xl" />
          </div>
        ))}
      </SkeletonCard>
      <HubLinksBone count={6} />
    </SkeletonPage>
  );
}
