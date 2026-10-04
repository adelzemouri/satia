import { Bone, SkeletonPage } from "@/ui/skeleton";

/** Squelette de l'ajout : titre et repas, recherche, photo / voix / code-barres, puis la liste. */
export default function AddLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-9 w-32 rounded-2xl" />
        <Bone className="h-14 w-44 rounded-full" />
      </div>
      <Bone className="h-14 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((index) => (
          <Bone key={index} className="h-24 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Bone className="h-12 w-full rounded-full" />
      <div className="flex flex-col rounded-[var(--radius-card)] bg-surface px-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex min-h-16 items-center gap-3 py-2">
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-5 w-3/5" />
              <Bone className="h-4 w-2/5" />
            </div>
            <Bone className="size-12 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
