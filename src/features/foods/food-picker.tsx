"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState, useTransition } from "react";

import { analyzeTextAction } from "@/features/ai/actions";
import { type AiAvailability, AiEntry } from "@/features/ai/ai-entry";
import type { MealDraft } from "@/features/ai/draft";
import { MealConfirmation } from "@/features/ai/meal-confirmation";
import { useErrorText } from "@/features/auth/use-error-text";
import { importOffAction, setFavoriteAction } from "@/features/journal/actions";
import type { MealSlot } from "@/domain/meals";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { FoodList } from "./food-list";
import { MealQueryField } from "./meal-query-field";
import type { FoodItem, OffItem, RecentItem } from "./food-types";
import { QuickAddButton } from "./quick-add-button";
import { RecentMore } from "./recent-more";
import { SlotSelect } from "./slot-select";
import { ProductThumb } from "./product-thumb";
import { QuantityForm } from "./quantity-form";
import { useFoodSearch } from "./use-food-search";
import { useRecentPages } from "./use-recent-pages";

const TABS = ["recent", "favorites", "mine"] as const;
type Tab = (typeof TABS)[number];

/**
 * Écran d'ajout : en haut, un grand champ où l'on écrit un aliment ou tout son repas (la base
 * répond en direct, Pépin analyse la phrase si on le demande), puis photo, voix et code-barres, les suggestions du
 * moment et les aliments récents (ajoutables d'un geste avec la dernière portion), favoris et personnels.
 */
export function FoodPicker({
  date,
  slot,
  recent: initialRecent,
  favorites: initialFavorites,
  mine,
  initialFood = null,
  inputMethod = "manual",
  initialSearch = false,
  ai,
  suggestions,
}: {
  date: string;
  slot: MealSlot;
  recent: RecentItem[];
  favorites: FoodItem[];
  mine: FoodItem[];
  initialFood?: FoodItem | null;
  inputMethod?: "manual" | "barcode";
  /** Ouvre le champ en recherche dans la base plutôt qu'en « Qu'as-tu mangé ? ». */
  initialSearch?: boolean;
  /** Saisie par photo, voix ou texte libre ; absente, seul l'ajout manuel est proposé. */
  ai?: { availability: AiAvailability };
  /** Repas habituel et idée du moment, affichés tant qu'aucune recherche n'est en cours. */
  suggestions?: ReactNode;
}) {
  const t = useTranslations("add");
  const tAll = useTranslations();
  const errorText = useErrorText();
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(initialFood);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [off, setOff] = useState<{ query: string; results: OffItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ draft: MealDraft; preview: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const [analyzing, startAnalysis] = useTransition();
  // Phrase venue d'une dictée corrigée : l'analyse la compte comme saisie vocale.
  const [fromVoice, setFromVoice] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const aiOn = ai?.availability.available ?? false;
  const [searchMode, setSearchMode] = useState(initialSearch);
  const { results, loading } = useFoodSearch(query);
  const more = useRecentPages(initialRecent);
  const recent = more.items ?? [];
  const favoriteIds = new Set(favorites.map((food) => food.id));

  const toggleFavorite = (food: FoodItem, favorite: boolean) => {
    setFavorites((list) => (favorite ? [...list, food] : list.filter((item) => item.id !== food.id)));
    startTransition(async () => {
      const result = await setFavoriteAction(food.id, favorite);
      if (result?.error) setError(result.error);
    });
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    if (!value) setFromVoice(false);
  };

  // Écrire mon repas (depuis le +, ou une dictée à corriger) : la phrase va dans le grand champ.
  const write = (text: string, dictated: boolean) => {
    setSearchMode(false);
    setQuery(text);
    setFromVoice(dictated);
    requestAnimationFrame(() => field.current?.focus());
  };

  const analyze = () => {
    const text = query.trim();
    if (!writing || text.length < 2 || analyzing) return;
    startAnalysis(async () => {
      setError(null);
      const result = await analyzeTextAction({ text, method: fromVoice ? "voice" : "text" }).catch(() => ({
        error: "network",
      }));
      if ("error" in result) setError(result.error);
      else setDraft({ draft: result.draft, preview: null });
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
        unitWeights: item.unitWeights,
        imageUrl: item.imageUrl,
      });
    });

  if (draft) {
    return (
      <MealConfirmation
        draft={draft.draft}
        photoPreview={draft.preview}
        date={date}
        slot={slot}
        onCancel={() => setDraft(null)}
      />
    );
  }

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
      <p className="py-3 text-text-muted">{empty}</p>
    ) : (
      <FoodList foods={foods} favoriteIds={favoriteIds} onSelect={setSelected} onToggleFavorite={toggleFavorite} />
    );

  // Avec l'IA, le grand champ part toujours chez Pépin ; la recherche dans la base reste à un lien
  // (aliment précis, produit du commerce) et prend le relais toute seule quand l'IA est coupée.
  const writing = aiOn && !searchMode;
  const searching = !writing && query.trim().length > 0;
  const barcodeHref = { pathname: "/scan", query: { date, slot } };

  return (
    <div data-wide className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <MealQueryField
          value={query}
          onValueChange={changeQuery}
          ai={writing}
          onSubmit={analyze}
          analyzing={analyzing}
          inputRef={field}
        />
        {aiOn && (
          <button
            type="button"
            onClick={() => {
              setSearchMode(!searchMode);
              field.current?.focus();
            }}
            className="self-start px-1 py-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {searchMode ? t("backToWrite") : t("searchInstead")}
          </button>
        )}
      </div>

      {error && <Alert>{errorText(error)}</Alert>}

      {searching ? (
        <section aria-label={t("tabs.search")} className="flex flex-col gap-4">
          {results && !loading && results.length === 0 && <p className="text-text-muted">{t("noResults")}</p>}
          {results && results.length > 0 && (
            <div className="rounded-[var(--radius-card)] bg-surface px-4">
              <FoodList
                foods={results}
                favoriteIds={favoriteIds}
                onSelect={setSelected}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}
          {query.trim().length >= 2 && (
            <section
              className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4"
              aria-labelledby="off-title"
            >
              <h2 id="off-title" className="font-bold">
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
                        className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                      >
                        <ProductThumb src={item.imageUrl} />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-sm text-text-muted">
                            {[item.brand, t("per100", { kcal: Math.round(item.kcal) })].filter(Boolean).join(" · ")}
                          </span>
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
        </section>
      ) : (
        // Sur ordinateur : la photo, la voix et les idées à gauche, les listes d'aliments à droite.
        <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            {ai ? (
              <AiEntry
                availability={ai.availability}
                barcodeHref={barcodeHref}
                dictationTitle={
                  <header className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h2>
                    <SlotSelect date={date} slot={slot} />
                  </header>
                }
                onDraft={(value, preview) => setDraft({ draft: value, preview })}
                onWrite={write}
              />
            ) : (
              <Link href={barcodeHref} className={buttonClass("secondary")}>
                <Icon name="barcode" />
                {t("scan")}
              </Link>
            )}

            {suggestions}
          </div>

          <section aria-label={t("listsTitle")} className="flex flex-col gap-3">
            <div
              role="tablist"
              aria-label={t("listsTitle")}
              className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1"
            >
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
                    tab === value ? "bg-surface text-text" : "text-text-muted"
                  }`}
                >
                  {t(`tabs.${value}`)}
                </button>
              ))}
            </div>
            <div
              id="food-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-1"
            >
              {tab === "recent" &&
                (recent.length === 0 ? (
                  <p className="py-3 text-text-muted">{t("emptyRecent")}</p>
                ) : (
                  <>
                    <FoodList
                      foods={recent}
                      favoriteIds={favoriteIds}
                      onSelect={setSelected}
                      trailing={(food) => {
                        const item = recent.find((value) => value.id === food.id)!;
                        return <QuickAddButton food={item} date={date} slot={slot} onError={setError} />;
                      }}
                      describe={(food) => {
                        const item = recent.find((value) => value.id === food.id)!;
                        return t("lastPortion", {
                          quantity: item.lastQuantity,
                          unit: tAll(`units.${item.lastUnit}`),
                          kcal: Math.round(item.lastKcal),
                        });
                      }}
                    />
                    <RecentMore hasMore={more.hasMore} loading={more.loading} onMore={more.loadMore} />
                  </>
                ))}
              {tab === "favorites" && list(favorites, t("emptyFavorites"))}
              {tab === "mine" && (
                <>
                  {list(mine, t("emptyMine"))}
                  <Link href="/foods" className={buttonClass("secondary", "mb-3")}>
                    {t("manageFoods")}
                  </Link>
                </>
              )}
            </div>
            <p className="text-sm text-text-muted">{t("quickAddHint")}</p>
          </section>
        </div>
      )}

      <p className="text-sm text-text-muted">
        <a href="https://ciqual.anses.fr" className="underline" target="_blank" rel="noreferrer">
          {t("ciqualAttribution")}
        </a>
      </p>
    </div>
  );
}
