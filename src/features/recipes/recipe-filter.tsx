"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { normalizeForSearch } from "@/domain/search";
import { Icon } from "@/ui/icon";
import { SearchInput } from "@/ui/search-input";

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
  categories,
  items,
}: {
  label: string;
  allLabel: string;
  searchLabel: string;
  noMatch: string;
  categories: readonly { value: C; label: string }[];
  /** `text` : nom et ingrédients, ce sur quoi porte la recherche. */
  items: readonly { key: string; category: C; text: string; card: ReactNode }[];
}) {
  const params = useSearchParams();
  const [category, setCategory] = useState<C | null>(
    () => categories.find((option) => option.value === params.get("cat"))?.value ?? null,
  );
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  const shown = items.filter((item) => {
    if (category && item.category !== category) return false;
    const text = normalizeForSearch(item.text);
    return words.every((word) => text.includes(word));
  });
  const remember = (key: "cat" | "q", value: string | null) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
  };
  const choose = (value: C | null) => {
    setCategory(value);
    remember("cat", value);
  };
  const chip = (active: boolean) =>
    `flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold ${
      active ? "bg-primary text-on-primary" : "bg-surface text-text"
    }`;
  const options: { value: C | null; label: string }[] = [{ value: null, label: allLabel }, ...categories];

  return (
    <>
      <label className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 focus-within:outline-2 focus-within:outline-[var(--color-focus)]">
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
      <div role="group" aria-label={label} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {options.map((option) => (
            <li key={option.value ?? "all"}>
              <button
                type="button"
                aria-pressed={category === option.value}
                onClick={() => choose(option.value)}
                className={chip(category === option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {shown.length === 0 ? (
        <p className="text-text-muted" role="status">
          {noMatch}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <li key={item.key} className="flex">
              {item.card}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
