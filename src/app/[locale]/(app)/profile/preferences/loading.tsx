import { FormPageBone, SkeletonPage } from "@/ui/skeleton";

/** Squelette d'une page de réglages de « Moi » (sans lui, celui de « Moi » s'afficherait). */
export default function PreferencesLoading() {
  return (
    <SkeletonPage>
      <FormPageBone />
    </SkeletonPage>
  );
}
