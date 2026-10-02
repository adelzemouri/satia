import { getTranslations } from "next-intl/server";

/**
 * Affiché immédiatement pendant le chargement d'une page de l'app : le clic se voit tout de suite,
 * et Next.js peut précharger cette coquille pour les liens visibles.
 */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-9 w-2/3 animate-pulse rounded-2xl bg-surface-muted" />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-sm"
        >
          <div className="h-6 w-1/2 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-4 w-full animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}
