"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo, useState, useTransition } from "react";

import type { MealSlot } from "@/domain/meals";
import { normalizeForSearch } from "@/domain/search";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { SearchInput } from "@/ui/search-input";
import { Sheet } from "@/ui/sheet";

import { addPlanItemAction } from "./actions";
import { ServingsStepper } from "./menu-controls";

export type MenuRecipe = {
  id: string;
  name: string;
  /** Calories d'une part, quand la recette en a. */
  kcal: number | null;
  /** Vignette : photo du catalogue ou de la recette, sinon une initiale. */
  thumb: string | null;
};

type Target = { date: string; slot: MealSlot; title: string };

const OpenPicker = createContext<(target: Target) => void>(() => {});

const DEFAULT_SERVINGS = 4;

/**
 * Une seule fenêtre de choix pour toute la page Menu : chaque « + » l'ouvre avec son jour et son
 * repas. On cherche une recette (du foyer, puis Pommelia) avec sa photo, ou on écrit un plat libre.
 */
export function MenuPickerProvider({
  household,
  catalog,
  children,
}: {
  household: MenuRecipe[];
  catalog: MenuRecipe[];
  children: ReactNode;
}) {
  const t = useTranslations("plan");
  const [target, setTarget] = useState<Target | null>(null);
  const [round, setRound] = useState(0);

  const open = (next: Target) => {
    setRound((value) => value + 1);
    setTarget(next);
  };

  return (
    <OpenPicker value={open}>
      {children}
      <Sheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.title ?? ""}
        closeLabel={t("close")}
        tall
      >
        {target && (
          <PickerBody
            key={round}
            target={target}
            household={household}
            catalog={catalog}
            onDone={() => setTarget(null)}
          />
        )}
      </Sheet>
    </OpenPicker>
  );
}

/** Le « + » d'un repas du menu (case du tableau sur ordinateur, ligne d'un jour sur téléphone). */
export function MenuPickButton({
  date,
  slot,
  title,
  label,
  variant,
}: {
  date: string;
  slot: MealSlot;
  /** Titre de la fenêtre : « Mardi 20 · Dîner ». */
  title: string;
  /** Nom accessible : « Ajouter un plat : mardi 20 octobre, dîner ». */
  label: string;
  /** `cell` : grande case vide ; `more` : petit « + » sous un plat ; `row` : « + Choisir » sur téléphone. */
  variant: "cell" | "more" | "row";
}) {
  const t = useTranslations("plan");
  const open = useContext(OpenPicker);
  const className =
    variant === "cell"
      ? "flex min-h-24 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border text-text-muted transition hover:border-primary hover:text-primary active:scale-[0.97]"
      : variant === "more"
        ? "flex min-h-9 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-muted hover:text-primary active:scale-[0.96]"
        : "flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold text-primary transition hover:bg-primary-soft active:scale-[0.96]";
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() => open({ date, slot, title })}
      className={className}
    >
      <Icon name="plus" size={variant === "row" ? 18 : 24} />
      {variant === "row" && <span aria-hidden="true">{t("choose")}</span>}
    </button>
  );
}

function PickerBody({
  target,
  household,
  catalog,
  onDone,
}: {
  target: Target;
  household: MenuRecipe[];
  catalog: MenuRecipe[];
  onDone: () => void;
}) {
  const t = useTranslations("plan");
  const errorText = useErrorText();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<MenuRecipe | null>(null);
  const [free, setFree] = useState(false);
  const [label, setLabel] = useState("");
  const [servings, setServings] = useState(DEFAULT_SERVINGS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const words = normalizeForSearch(query).split(" ").filter(Boolean);
    const keep = (recipe: MenuRecipe) => {
      const name = normalizeForSearch(recipe.name);
      return words.every((word) => name.includes(word));
    };
    return [
      { key: "household", title: t("householdRecipes"), recipes: household.filter(keep) },
      { key: "catalog", title: t("catalogRecipes"), recipes: catalog.filter(keep) },
    ].filter((group) => group.recipes.length > 0);
  }, [query, household, catalog, t]);

  const submit = () =>
    startTransition(async () => {
      const result = await addPlanItemAction({
        date: target.date,
        slot: target.slot,
        foodId: free ? null : (picked?.id ?? null),
        label: free ? label : "",
        servings,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      haptic();
      onDone();
    });

  const canSubmit = free ? label.trim().length > 0 : picked !== null;

  return (
    <>
      {free ? (
        <div className="flex flex-col gap-3">
          <Field
            label={t("label")}
            hint={t("labelHint")}
            name="label"
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- on vient de demander à écrire un plat
            autoFocus
          />
          <button
            type="button"
            onClick={() => setFree(false)}
            className="self-start text-sm font-semibold text-primary"
          >
            {t("backToRecipes")}
          </button>
        </div>
      ) : (
        <>
          <label className="flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 focus-within:outline-2 focus-within:outline-[var(--color-focus)]">
            <Icon name="search" size={20} />
            <span className="sr-only">{t("searchRecipe")}</span>
            <SearchInput value={query} onValueChange={setQuery} placeholder={t("searchRecipe")} />
          </label>
          {groups.length === 0 && <p className="text-sm text-text-muted">{t("noMatch")}</p>}
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title} className="flex flex-col gap-1">
              <h3 className="text-xs font-bold tracking-wide text-text-muted uppercase">{group.title}</h3>
              <ul className="flex flex-col">
                {group.recipes.map((recipe) => {
                  const selected = picked?.id === recipe.id;
                  return (
                    <li key={recipe.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPicked(recipe)}
                        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition active:scale-[0.99] ${
                          selected ? "bg-primary-soft" : "hover:bg-surface-muted"
                        }`}
                      >
                        {recipe.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- petites vignettes déjà redimensionnées
                          <img
                            src={recipe.thumb}
                            alt=""
                            loading="lazy"
                            className="size-12 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-bold text-primary"
                          >
                            {recipe.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="leading-snug font-semibold">{recipe.name}</span>
                          {recipe.kcal !== null && (
                            <span className="text-sm text-text-muted">{t("perServing", { kcal: recipe.kcal })}</span>
                          )}
                        </span>
                        {selected && (
                          <span className="text-primary">
                            <Icon name="check" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <button
            type="button"
            onClick={() => {
              setFree(true);
              setPicked(null);
            }}
            className="min-h-11 self-start text-left font-semibold text-primary"
          >
            {t("freeDish")}
          </button>
        </>
      )}
      {/* Les parts et la validation restent en bas, même quand la liste défile. */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-border bg-surface pt-3">
        <ServingsStepper value={servings} onChange={setServings} />
        {error && <Alert>{errorText(error)}</Alert>}
        <Button onClick={submit} disabled={pending || !canSubmit}>
          {t("add")}
        </Button>
      </div>
    </>
  );
}
