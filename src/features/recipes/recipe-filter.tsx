"use client";

import { type ReactNode, useState } from "react";

/**
 * Idées de recettes filtrées par catégorie sur place : pas de rechargement ni de retour en haut
 * de page. L'adresse garde le filtre (?cat=) pour le retour arrière et le partage.
 */
export function RecipeFilter<C extends string>({
  label,
  allLabel,
  categories,
  items,
  initial,
}: {
  label: string;
  allLabel: string;
  categories: readonly { value: C; label: string }[];
  items: readonly { key: string; category: C; card: ReactNode }[];
  initial: C | null;
}) {
  const [category, setCategory] = useState<C | null>(initial);
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items
          .filter((item) => !category || item.category === category)
          .map((item) => (
            <li key={item.key} className="flex">
              {item.card}
            </li>
          ))}
      </ul>
    </>
  );
}
