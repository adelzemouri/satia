import { FormPageBone, SkeletonPage } from "@/ui/skeleton";

/** Squelette d'une page de réglages de « Moi » (sans lui, celui de « Moi » s'afficherait). */
export default function AccountLoading() {
  return (
    <SkeletonPage wide className="desktop-columns">
      <FormPageBone />
    </SkeletonPage>
  );
}
