"use client";

import { useState, useTransition } from "react";

import { FoodList } from "@/features/foods/food-list";
import type { FoodItem } from "@/features/foods/food-types";
import { setFavoriteAction } from "@/features/journal/actions";
import { useRouter } from "@/i18n/navigation";

/** Recettes du foyer : toucher une recette ouvre sa fiche, l'étoile la met en favori. */
export function FamilyRecipeList({ recipes, favoriteIds }: { recipes: FoodItem[]; favoriteIds: string[] }) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(() => new Set(favoriteIds));
  const [, startTransition] = useTransition();
  return (
    <FoodList
      foods={recipes}
      favoriteIds={favorites}
      onSelect={(food) => router.push(`/foods/${food.id}`)}
      onToggleFavorite={(food, favorite) => {
        setFavorites((set) => {
          const next = new Set(set);
          if (favorite) next.add(food.id);
          else next.delete(food.id);
          return next;
        });
        startTransition(async () => {
          await setFavoriteAction(food.id, favorite);
        });
      }}
    />
  );
}
