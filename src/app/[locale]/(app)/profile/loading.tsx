import { Bone, SkeletonPage } from "@/ui/skeleton";

/** Squelette de « Moi » : avatar et nom, puis la liste des rubriques. */
export default function ProfileLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center gap-4">
        <Bone className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Bone className="h-8 w-32 rounded-2xl" />
          <Bone className="h-5 w-48" />
        </div>
      </div>
      <div className="flex flex-col rounded-[var(--radius-card)] bg-surface px-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex min-h-16 items-center gap-4 px-3 py-2">
            <Bone className="size-10 rounded-full" />
            <Bone className="h-5 flex-1" />
            <Bone className="size-5 rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
