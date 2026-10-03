"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Icon } from "@/ui/icon";

import type { FoodItem } from "./food-types";
import { ProductThumb } from "./product-thumb";

/**
 * Liste d'aliments : toucher le nom le choisit, l'étoile le met en favori. `trailing` remplace
 * l'étoile (ajout en un geste des récents) et `describe` la ligne de détail.
 */
export function FoodList({
  foods,
  favoriteIds,
  onSelect,
  onToggleFavorite,
  trailing,
  describe,
}: {
  foods: FoodItem[];
  favoriteIds: ReadonlySet<string>;
  onSelect: (food: FoodItem) => void;
  onToggleFavorite?: (food: FoodItem, favorite: boolean) => void;
  trailing?: (food: FoodItem) => ReactNode;
  describe?: (food: FoodItem) => string;
}) {
  const t = useTranslations("add");
  return (
    <ul className="flex flex-col divide-y divide-border">
      {foods.map((food) => {
        const favorite = favoriteIds.has(food.id);
        return (
          <li key={food.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(food)}
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left"
            >
              {food.imageUrl && <ProductThumb src={food.imageUrl} />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="w-full truncate font-semibold">{food.nameFr}</span>
                <span className="text-sm text-text-muted">
                  {describe?.(food) ??
                    [
                      food.brand,
                      t(food.householdId ? "sources.family" : `sources.${food.source}`),
                      t("per100", { kcal: Math.round(food.kcal) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                </span>
              </span>
            </button>
            {trailing?.(food)}
            {!trailing && onToggleFavorite && (
              <button
                type="button"
                aria-pressed={favorite}
                aria-label={t(favorite ? "unfavorite" : "favorite", { name: food.nameFr })}
                onClick={() => onToggleFavorite(food, !favorite)}
                className={`flex size-12 items-center justify-center rounded-full ${favorite ? "text-carbs" : "text-text-muted"}`}
              >
                <Icon name="star" filled={favorite} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
