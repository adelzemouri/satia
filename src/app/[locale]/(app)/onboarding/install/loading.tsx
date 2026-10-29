import { Bone, SkeletonPage, TitleBone } from "@/ui/skeleton";

/** Squelette du dernier écran de l'inscription : icône, titre, étapes, bouton. */
export default function OnboardingInstallLoading() {
  return (
    <SkeletonPage className="mx-auto w-full max-w-md lg:pt-8">
      <div className="flex flex-col items-center gap-3">
        <Bone className="size-20 rounded-[1.4rem]" />
        <TitleBone className="w-3/4" />
        <Bone className="h-5 w-full" />
      </div>
      <Bone className="h-64 w-full rounded-[var(--radius-card)]" />
      <Bone className="h-12 w-full rounded-full" />
    </SkeletonPage>
  );
}
