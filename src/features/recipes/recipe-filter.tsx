"use client";

import { type ReactNode, useState } from "react";

import { normalizeForSearch } from "@/domain/search";
import { Icon } from "@/ui/icon";

/**
 * Recettes cherchées par nom ou ingrédient et filtrées par catégorie sur place : pas de rechargement ni de retour en haut
 * de page. L'adresse garde le filtre (?cat=) pour le retour arrière et le partage.
 */
export function RecipeFilter<C extends string>({
  label,
  allLabel,
  searchLabel,
  noMatch,
  categories,
  items,
  initial,
}: {
  label: string;
  allLabel: string;
  searchLabel: string;
  noMatch: string;
  categories: readonly { value: C; label: string }[];
  /** `text` : nom et ingrédients, ce sur quoi porte la recherche. */
  items: readonly { key: string; category: C; text: string; card: ReactNode }[];
  initial: C | null;
}) {
  const [category, setCategory] = useState<C | null>(initial);
  const [query, setQuery] = useState("");
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  const shown = items.filter((item) => {
    if (category && item.category !== category) return false;
    const text = normalizeForSearch(item.text);
    return words.every((word) => text.includes(word));
  });
  const choose = (value: C | null) => {
    setCategory(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("cat", value);
    else url.searchParams.delete("cat");
    window.history.replaceState(null, "", url);
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
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchLabel}
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
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
