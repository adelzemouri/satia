import { Bone, HubLinksBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de « Moi » : initiale et nom, les rubriques, les réglages, puis la déconnexion. */
export default function ProfileLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center gap-4">
        <Bone className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <TitleBone className="w-32" />
          <Bone className="h-5 w-48" />
        </div>
      </div>
      <HubLinksBone count={5} />
      <Bone className="mt-2 h-6 w-28" />
      <HubLinksBone count={6} hints />
      <Bone className="h-12 w-full rounded-full" />
    </SkeletonPage>
  );
}
