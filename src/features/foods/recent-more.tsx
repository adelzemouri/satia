"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/button";

/** « Voir plus » sous la liste des récents : ajoute la page suivante à la suite. */
export function RecentMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  const t = useTranslations("add");
  if (!hasMore) return null;
  return (
    <Button variant="ghost" onClick={onMore} disabled={loading} aria-busy={loading} className="mb-2 w-full">
      {loading ? t("recentMoreLoading") : t("recentMore")}
    </Button>
  );
}
