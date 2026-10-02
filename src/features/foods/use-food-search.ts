"use client";

import { useEffect, useState } from "react";

import type { FoodItem } from "./food-types";

/** Recherche dans la base locale, relancée 250 ms après la dernière frappe. */
export function useFoodSearch(query: string) {
  const q = query.trim();
  const [found, setFound] = useState<{ query: string; results: FoodItem[] } | null>(null);

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (response.ok) setFound({ query: q, results: ((await response.json()) as { results: FoodItem[] }).results });
      } catch {
        // Recherche annulée par une frappe plus récente, ou hors ligne : on garde l'affichage.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q]);

  if (q.length < 2) return { results: null, loading: false };
  return { results: found?.query === q ? found.results : null, loading: found?.query !== q };
}
