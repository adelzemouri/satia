import { Bone, RingBone, SkeletonCard, SkeletonPage, TitleBone } from "@/ui/skeleton";

/**
 * Squelette de l'accueil, à la forme de la page : date, série et profil, bonjour et bulle de
 * Pépin, semaine ; puis la journée (anneau, macros, repas) et les idées ; enfin l'eau, l'activité
 * et Pépin. Sur ordinateur, les mêmes deux colonnes que la page.
 */
export default function HomeLoading() {
  return (
    <SkeletonPage wide className="lg:grid lg:grid-cols-[1.45fr_1fr] lg:items-start">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="flex items-center gap-3">
          <Bone className="h-12 w-44 rounded-full" />
          <Bone className="ml-auto h-12 w-16 rounded-full" />
          <Bone className="size-12 shrink-0 rounded-full" />
        </div>
        <div className="flex flex-col gap-1">
          <TitleBone className="w-56" />
          <div className="mt-1 flex items-end gap-2">
            <Bone className="size-10 shrink-0 rounded-full" />
            <Bone className="h-14 w-full max-w-sm rounded-2xl rounded-bl-md" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} className="flex flex-col items-center gap-1 py-1">
              <Bone className="h-3 w-6" />
              <RingBone className="size-[38px] border-4" />
            </div>
          ))}
        </div>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <SkeletonCard>
          <div className="flex items-center gap-5">
            <RingBone className="size-36 border-[12px]" />
            <div className="flex flex-1 flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col gap-1.5">
                  <Bone className="h-4 w-16" />
                  <Bone className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Bone className="h-4 w-16" />
                <Bone className="h-2 w-full rounded-full" />
                <Bone className="h-4 w-14" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Bone className="h-6 w-24" />
            <Bone className="h-4 w-20" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col items-center gap-1.5 px-1 py-2">
                <RingBone className="size-14 border-[5px]" />
                <Bone className="h-3 w-14" />
                <Bone className="h-3 w-12" />
              </div>
            ))}
          </div>
        </SkeletonCard>

        <div className="order-last flex flex-col gap-3 lg:order-none">
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-7 w-48" />
            <Bone className="h-5 w-16" />
          </div>
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex w-[44%] shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface sm:w-[30%] lg:w-auto"
              >
                <Bone className="aspect-[4/3] w-full rounded-none" />
                <div className="flex flex-col gap-2 px-3 py-2">
                  <Bone className="h-4 w-4/5" />
                  <Bone className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <SkeletonCard className="gap-3">
          <Bone className="h-6 w-16" />
          <Bone className="h-4 w-44" />
          <div className="flex flex-wrap gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <Bone key={index} className="h-12 w-9" />
            ))}
          </div>
        </SkeletonCard>

        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface px-4 py-3">
              <Bone className="h-4 w-20" />
              <Bone className="h-6 w-16" />
              <Bone className="h-3 w-24" />
            </div>
          ))}
        </div>

        <SkeletonCard className="gap-3">
          <div className="flex items-center gap-3">
            <Bone className="size-11 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bone className="h-5 w-36" />
              <Bone className="h-4 w-48" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["w-40", "w-32", "w-36"].map((width) => (
              <Bone key={width} className={`h-11 rounded-full ${width}`} />
            ))}
          </div>
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
