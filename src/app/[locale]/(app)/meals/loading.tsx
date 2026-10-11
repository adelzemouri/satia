import { Bone, KitchenTabsBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de « Mes repas » : onglets Cuisine, titre, puis les cartes (nom, anneau des macros, pied). */
export default function MealsLoading() {
  return (
    <SkeletonPage wide>
      <KitchenTabsBone />
      <TitleBone className="w-1/2" />
      <Bone className="h-5 w-4/5" />
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
            <div className="flex items-center gap-2">
              <Bone className="h-6 flex-1" />
              <Bone className="size-10 rounded-full" />
              <Bone className="size-10 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Bone className="size-20 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-full" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <Bone className="h-5 w-24" />
              <Bone className="h-11 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
