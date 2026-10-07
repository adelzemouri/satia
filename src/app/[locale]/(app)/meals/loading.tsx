import { Bone, KitchenTabsBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de « Mes repas » : onglets Cuisine, titre, puis la liste des repas enregistrés. */
export default function MealsLoading() {
  return (
    <SkeletonPage wide>
      <KitchenTabsBone />
      <TitleBone className="w-1/2" />
      <Bone className="h-5 w-4/5" />
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-4">
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-5 w-2/5" />
              <Bone className="h-4 w-4/5" />
              <Bone className="h-4 w-20" />
            </div>
            <Bone className="size-11 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
