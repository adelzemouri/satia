"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { setFavoriteAction } from "@/features/journal/actions";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";

/**
 * Recettes favorites de l'utilisateur (les mêmes favoris que les aliments : une recette favorite se
 * retrouve aussi dans l'onglet Favoris de « Écrire »). L'étoile change tout de suite ; un retrait
 * peut être annulé depuis le bandeau, et un échec d'enregistrement remet l'étoile comme avant.
 */
export function useRecipeFavorites(initial: readonly string[]) {
  const t = useTranslations("recipes");
  const errorText = useErrorText();
  const toast = useToast();
  const [ids, setIds] = useState(() => new Set(initial));

  const put = useCallback((id: string, favorite: boolean) => {
    setIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const save = useCallback(
    (id: string, favorite: boolean) =>
      setFavoriteAction(id, favorite).then((result) => {
        if (!result?.error) return true;
        put(id, !favorite);
        toast({ message: errorText(result.error) ?? t("favoriteError") });
        return false;
      }),
    [errorText, put, t, toast],
  );

  const toggle = useCallback(
    (id: string, name: string) => {
      const favorite = !ids.has(id);
      put(id, favorite);
      void save(id, favorite).then((saved) => {
        if (!saved) return;
        toast(
          favorite
            ? { message: t("favoriteAdded", { name }) }
            : {
                message: t("favoriteRemoved", { name }),
                undo: () => {
                  put(id, true);
                  void save(id, true);
                },
              },
        );
      });
    },
    [ids, put, save, t, toast],
  );

  return { ids, toggle };
}

/** L'étoile d'une recette : posée sur la photo d'une vignette, ou ronde à côté du titre de la fiche. */
export function FavoriteStar({
  name,
  favorite,
  onToggle,
  variant,
}: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
  variant: "card" | "sheet";
}) {
  const t = useTranslations("recipes");
  const star = (
    // La clé relance le petit rebond quand l'étoile se remplit.
    <span key={String(favorite)} className={favorite ? "pop flex" : "flex"}>
      <Icon name="star" filled={favorite} size={variant === "card" ? 18 : 22} />
    </span>
  );
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={favorite}
      aria-label={t(favorite ? "favoriteRemove" : "favoriteAdd", { name })}
      title={t(favorite ? "favoriteRemove" : "favoriteAdd", { name })}
      className={
        variant === "card"
          ? "group absolute top-0.5 right-0.5 flex size-11 items-center justify-center"
          : `flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface transition-transform active:scale-[0.97] ${
              favorite ? "text-carbs" : "text-text-muted"
            }`
      }
    >
      {variant === "card" ? (
        <span
          className={`flex size-8 items-center justify-center rounded-full bg-white/90 shadow-[0_1px_4px_rgb(17_24_22/0.18)] transition-transform group-active:scale-[0.92] ${
            favorite ? "text-[#8a6418]" : "text-[#56625d]"
          }`}
        >
          {star}
        </span>
      ) : (
        star
      )}
    </button>
  );
}

/** Étoile de la fiche d'une recette, seule sur sa page. */
export function RecipeFavoriteButton({ id, name, initial }: { id: string; name: string; initial: boolean }) {
  const { ids, toggle } = useRecipeFavorites(initial ? [id] : []);
  return <FavoriteStar name={name} favorite={ids.has(id)} onToggle={() => toggle(id, name)} variant="sheet" />;
}
