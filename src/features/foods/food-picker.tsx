"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { importOffAction, setFavoriteAction } from "@/features/journal/actions";
import type { MealSlot } from "@/domain/meals";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { FoodList } from "./food-list";
import type { FoodItem, OffItem } from "./food-types";
import { QuantityForm } from "./quantity-form";
import { useFoodSearch } from "./use-food-search";

const TABS = ["search", "recent", "favorites", "mine"] as const;
type Tab = (typeof TABS)[number];

/** Écran d'ajout : recherche, récents, favoris et aliments personnels, puis la quantité. */
export function FoodPicker({
  date,
  slot,
  recent,
  favorites: initialFavorites,
  mine,
  initialFood = null,
  inputMethod = "manual",
}: {
  date: string;
  slot: MealSlot;
  recent: FoodItem[];
  favorites: FoodItem[];
  mine: FoodItem[];
  initialFood?: FoodItem | null;
  inputMethod?: "manual" | "barcode";
}) {
  const t = useTranslations("add");
  const errorText = useErrorText();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(initialFood);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [off, setOff] = useState<{ query: string; results: OffItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { results, loading } = useFoodSearch(query);
  const favoriteIds = new Set(favorites.map((food) => food.id));

  const toggleFavorite = (food: FoodItem, favorite: boolean) => {
    setFavorites((list) => (favorite ? [...list, food] : list.filter((item) => item.id !== food.id)));
    startTransition(async () => {
      const result = await setFavoriteAction(food.id, favorite);
      if (result?.error) setError(result.error);
    });
  };

  const searchOff = () =>
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/foods/off?q=${encodeURIComponent(query.trim())}`).catch(() => null);
      const body = (await response?.json().catch(() => null)) as { results?: OffItem[]; error?: string } | null;
      if (!response?.ok || !body?.results) setError(body?.error ?? "off_unavailable");
      else setOff({ query, results: body.results });
    });

  const chooseOff = (item: OffItem) =>
    startTransition(async () => {
      const result = await importOffAction(item.code);
      if (!result?.id) return setError(result?.error ?? "generic");
      setSelected({
        id: result.id,
        source: "off",
        nameFr: item.name,
        brand: item.brand,
        kcal: item.kcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        densityGPerMl: null,
        unitWeights: item.servingGrams ? { portion: item.servingGrams } : null,
      });
    });

  if (selected) {
    return (
      <QuantityForm
        food={selected}
        date={date}
        slot={slot}
        inputMethod={selected.id === initialFood?.id ? inputMethod : "manual"}
        onCancel={() => setSelected(null)}
      />
    );
  }

  const list = (foods: FoodItem[], empty: string) =>
    foods.length === 0 ? (
      <p className="text-text-muted">{empty}</p>
    ) : (
      <FoodList foods={foods} favoriteIds={favoriteIds} onSelect={setSelected} onToggleFavorite={toggleFavorite} />
    );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("title")} className="grid grid-cols-4 gap-1 rounded-full bg-surface-muted p-1">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls="food-panel"
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-full px-1 text-sm font-semibold ${
              tab === value ? "bg-surface text-text shadow-sm" : "text-text-muted"
            }`}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      {error && <Alert>{errorText(error)}</Alert>}

      <Link href={{ pathname: "/scan", query: { date, slot } }} className={buttonClass("secondary")}>
        <Icon name="barcode" />
        {t("scan")}
      </Link>

      <div id="food-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
        {tab === "search" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("searchLabel")}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchHint")}
                autoComplete="off"
                className="min-h-12 rounded-2xl border border-border bg-surface px-4 text-base"
              />
            </label>
            {results && !loading && results.length === 0 && <p className="text-text-muted">{t("noResults")}</p>}
            {results && results.length > 0 && (
              <FoodList
                foods={results}
                favoriteIds={favoriteIds}
                onSelect={setSelected}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {query.trim().length >= 2 && (
              <section className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-4" aria-labelledby="off-title">
                <h2 id="off-title" className="font-semibold">
                  {t("offTitle")}
                </h2>
                <Button variant="secondary" onClick={searchOff} disabled={pending}>
                  {t("offSearch")}
                </Button>
                {off?.query === query && off.results.length === 0 && <p>{t("offNoResults")}</p>}
                {off?.query === query && off.results.length > 0 && (
                  <ul className="flex flex-col divide-y divide-border">
                    {off.results.map((item) => (
                      <li key={item.code}>
                        <button
                          type="button"
                          onClick={() => chooseOff(item)}
                          disabled={pending}
                          className="flex min-h-14 w-full flex-col items-start justify-center py-2 text-left"
                        >
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-sm text-text-muted">
                            {[item.brand, t("per100", { kcal: Math.round(item.kcal) })].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-text-muted">
                  <a href="https://world.openfoodfacts.org" className="underline" target="_blank" rel="noreferrer">
                    {t("offAttribution")}
                  </a>
                </p>
              </section>
            )}
          </>
        )}
        {tab === "recent" && list(recent, t("emptyRecent"))}
        {tab === "favorites" && list(favorites, t("emptyFavorites"))}
        {tab === "mine" && (
          <>
            {list(mine, t("emptyMine"))}
            <Link href="/foods" className={buttonClass("secondary")}>
              {t("manageFoods")}
            </Link>
          </>
        )}
      </div>

      <p className="text-sm text-text-muted">
        <a href="https://ciqual.anses.fr" className="underline" target="_blank" rel="noreferrer">
          {t("ciqualAttribution")}
        </a>
      </p>
    </div>
  );
}
