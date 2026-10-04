import { Bone, SkeletonCard, SkeletonPage } from "@/ui/skeleton";

/**
 * Affiché immédiatement pendant le chargement d'une page de l'app : le clic se voit tout de suite,
 * et Next.js peut précharger cette coquille pour les liens visibles. Les pages les plus visitées
 * (journal, progrès, recettes) ont leur propre squelette, à leur forme.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <Bone className="h-9 w-2/3 rounded-2xl" />
      {[0, 1, 2].map((index) => (
        <SkeletonCard key={index}>
          <Bone className="h-6 w-1/2" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-5/6" />
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
