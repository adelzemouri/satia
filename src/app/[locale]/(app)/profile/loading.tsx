import { Bone, HubLinksBone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette de « Moi » : initiale et nom, objectifs et raccourcis, réglages et déconnexion. */
export default function ProfileLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-8">
      <div className="flex items-center gap-4 lg:col-span-2">
        <Bone className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <TitleBone className="w-32" />
          <Bone className="h-5 w-48" />
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
        <Bone className="mt-2 h-6 w-32" />
        <HubLinksBone count={6} />
      </div>
      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <Bone className="mt-2 h-6 w-28" />
        <HubLinksBone count={6} />
      </div>
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-3">
        <Bone className="mt-2 h-6 w-24" />
        <HubLinksBone count={4} hints />
      </div>
      <div className="lg:col-start-2 lg:row-start-3 lg:pt-12">
        <Bone className="h-12 w-full rounded-full lg:max-w-xs" />
      </div>
    </SkeletonPage>
  );
}
