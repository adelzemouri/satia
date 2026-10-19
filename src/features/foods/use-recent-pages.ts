"use client";

import { useState, useTransition } from "react";

import { RECENT_PAGE } from "@/domain/food-name";
import { recentFoodsAction } from "@/features/journal/actions";

import type { RecentItem } from "./food-types";

/**
 * Liste « Récents » page par page : « Voir plus » ajoute les aliments suivants à la suite.
 * Le bouton disparaît dès qu'une page revient incomplète.
 */
export function useRecentPages(initial: RecentItem[] | null) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initial ? initial.length >= RECENT_PAGE : false);
  const [loading, startLoading] = useTransition();

  const receive = (page: RecentItem[], previous: RecentItem[]) => {
    // Une saisie faite entre deux pages peut décaler la liste : on ne garde pas deux fois un aliment.
    const known = new Set(previous.map((item) => item.id));
    setItems([...previous, ...page.filter((item) => !known.has(item.id))]);
    setHasMore(page.length >= RECENT_PAGE);
  };

  /** Première page, chargée à l'ouverture quand la liste n'a pas été fournie par le serveur. */
  const loadFirst = () => {
    if (items) return;
    void recentFoodsAction(0).then(
      (page) => receive(page, []),
      () => setItems([]),
    );
  };

  const loadMore = () => {
    const current = items ?? [];
    startLoading(async () => {
      const page = await recentFoodsAction(current.length).catch(() => null);
      if (page) receive(page, current);
    });
  };

  return { items, hasMore, loading, loadFirst, loadMore };
}
