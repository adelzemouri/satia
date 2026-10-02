"use client";

import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icon";

import type { FoodItem } from "./food-types";

/** Liste d'aliments : toucher le nom le choisit, l'étoile le met en favori. */
export function FoodList({
  foods,
  favoriteIds,
  onSelect,
  onToggleFavorite,
}: {
  foods: FoodItem[];
  favoriteIds: ReadonlySet<string>;
  onSelect: (food: FoodItem) => void;
  onToggleFavorite?: (food: FoodItem, favorite: boolean) => void;
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
              className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center py-2 text-left"
            >
              <span className="w-full truncate font-semibold">{food.nameFr}</span>
              <span className="text-sm text-text-muted">
                {[food.brand, t(`sources.${food.source}`), t("per100", { kcal: Math.round(food.kcal) })]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
            {onToggleFavorite && (
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
