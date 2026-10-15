"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SearchInput } from "@/ui/search-input";

import { FoodList } from "./food-list";
import type { FoodItem } from "./food-types";
import { useFoodSearch } from "./use-food-search";

/** Champ de recherche compact dans la base locale, avec des suggestions avant la frappe. */
export function FoodSearchBox({
  label,
  suggestions = [],
  onSelect,
}: {
  label: string;
  suggestions?: FoodItem[];
  onSelect: (food: FoodItem) => void;
}) {
  const t = useTranslations("add");
  const [query, setQuery] = useState("");
  const { results, loading } = useFoodSearch(query);
  const shown = results ?? (query.trim().length < 2 ? suggestions : []);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{label}</span>
        <span className="focus-within:outline-focus flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4 focus-within:outline-3">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            // Ce champ vit souvent dans un formulaire : Entrée ne doit pas l'envoyer.
            onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
            placeholder={t("searchHint")}
            autoComplete="off"
          />
        </span>
      </label>
      {results && !loading && results.length === 0 && <p className="text-text-muted">{t("noResults")}</p>}
      {shown.length > 0 && <FoodList foods={shown} favoriteIds={new Set()} onSelect={onSelect} />}
    </div>
  );
}
