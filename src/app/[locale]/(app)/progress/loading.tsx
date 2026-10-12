import { Bone, HubLinksBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette de « Progrès », à la forme de la page : le poids d'abord, puis les rubriques.
 * Deux colonnes sur ordinateur.
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
      <HubLinksBone count={6} />
    </SkeletonPage>
  );
}
