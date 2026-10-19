"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { normalizeForSearch } from "@/domain/search";
import { Icon } from "@/ui/icon";
import { SearchInput } from "@/ui/search-input";

import { FavoriteStar, useRecipeFavorites } from "./favorite-star";

/** Filtre « Favoris », placé juste après « Toutes » ; l'adresse le garde comme les catégories (?cat=favoris). */
const FAVORITES = "favoris";

/**
 * Recettes cherchées par nom ou ingrédient et filtrées par catégorie sur place : pas de rechargement ni de retour en haut
 * de page. L'adresse garde le filtre (?cat=) et la recherche (?q=) pour le retour arrière et le partage : on les relit
 * dans l'adresse plutôt que dans les props, car au retour depuis une fiche Next.js réaffiche la page telle qu'elle était
 * rendue à l'arrivée, avant le choix du filtre.
 */
export function RecipeFilter<C extends string>({
  label,
  allLabel,
  searchLabel,
  noMatch,
  favoritesLabel,
  noFavorites,
  categories,
  items,
  favoriteIds,
}: {
  label: string;
  allLabel: string;
  searchLabel: string;
  noMatch: string;
  favoritesLabel: string;
  noFavorites: string;
  categories: readonly { value: C; label: string }[];
  /** `key` : l'identifiant de la recette ; `text` : nom et ingrédients, ce sur quoi porte la recherche. */
  items: readonly { key: string; name: string; category: C; text: string; card: ReactNode }[];
  /** Recettes mises en favori par l'utilisateur. */
  favoriteIds: readonly string[];
}) {
  const params = useSearchParams();
  const favorites = useRecipeFavorites(favoriteIds);
  const [category, setCategory] = useState<C | typeof FAVORITES | null>(() => {
    const wanted = params.get("cat");
    if (wanted === FAVORITES) return FAVORITES;
    return categories.find((option) => option.value === wanted)?.value ?? null;
  });
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  const shown = items.filter((item) => {
    if (category === FAVORITES ? !favorites.ids.has(item.key) : category && item.category !== category) return false;
    const text = normalizeForSearch(item.text);
    return words.every((word) => text.includes(word));
  });
  const remember = (key: "cat" | "q", value: string | null) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
  };
  const choose = (value: C | typeof FAVORITES | null) => {
    setCategory(value);
    remember("cat", value);
  };
  const chip = (active: boolean) =>
    `flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold ${
      active ? "bg-primary text-on-primary" : "bg-surface text-text"
    }`;
  const favoriteCount = items.filter((item) => favorites.ids.has(item.key)).length;
  const options: { value: C | typeof FAVORITES | null; label: string }[] = [
    { value: null, label: allLabel },
    { value: FAVORITES, label: favoritesLabel },
    ...categories,
  ];

  return (
    <>
      {/* Sur ordinateur, la recherche et les catégories tiennent sur une ligne qui reste en haut pendant le défilement. */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-0 lg:z-10 lg:-mx-2 lg:flex-row lg:items-center lg:gap-3 lg:bg-bg lg:px-2 lg:py-3">
        <label className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 focus-within:outline-2 focus-within:outline-[var(--color-focus)] lg:min-w-64 lg:flex-1">
          <Icon name="search" size={20} />
          <span className="sr-only">{searchLabel}</span>
          <SearchInput
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              remember("q", value.trim() || null);
            }}
            placeholder={searchLabel}
          />
        </label>
        <div role="group" aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:min-w-0 lg:px-0">
          <ul className="flex gap-2">
            {options.map((option) => (
              <li key={option.value ?? "all"}>
                <button
                  type="button"
                  aria-pressed={category === option.value}
                  onClick={() => choose(option.value)}
                  className={chip(category === option.value)}
                >
                  {option.value === FAVORITES ? (
                    <span className="flex items-center gap-1.5">
                      <span className={category === FAVORITES ? "flex" : "flex text-carbs"}>
                        <Icon name="star" filled size={18} />
                      </span>
                      {option.label}
                      {favoriteCount > 0 && <span aria-hidden="true">· {favoriteCount}</span>}
                    </span>
                  ) : (
                    option.label
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-text-muted" role="status">
          {category === FAVORITES && favoriteCount === 0 ? noFavorites : noMatch}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((item) => (
            <li key={item.key} className="relative flex">
              {item.card}
              {/* À côté du lien de la vignette, pas dedans : un bouton ne se met pas dans un lien. */}
              <FavoriteStar
                name={item.name}
                favorite={favorites.ids.has(item.key)}
                onToggle={() => favorites.toggle(item.key, item.name)}
                variant="card"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
