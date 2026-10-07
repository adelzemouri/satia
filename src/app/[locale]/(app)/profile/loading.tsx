import { Bone, HubLinksBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de « Moi » : initiale et nom, les rubriques, les réglages, puis la déconnexion. */
export default function ProfileLoading() {
  return (
    <SkeletonPage wide className="desktop-columns">
      <div className="flex items-center gap-4">
        <Bone className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <TitleBone className="w-32" />
          <Bone className="h-5 w-48" />
        </div>
      </div>
      <div data-col>
        <HubLinksBone count={5} />
      </div>
      <div data-col className="flex flex-col gap-6">
        <Bone className="mt-2 h-6 w-28 lg:mt-0" />
        <HubLinksBone count={6} hints />
      </div>
      <Bone className="h-12 w-full rounded-full lg:max-w-xs" />
    </SkeletonPage>
  );
}
