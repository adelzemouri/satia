"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";

import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

/**
 * Grand champ de l'écran d'ajout : on y écrit son repas et Pépin le compte (Analyser ou Entrée),
 * avant l'écran de vérification. Il grandit avec le texte pour garder la phrase lisible sur
 * téléphone. Sans IA, c'est un simple champ de recherche.
 */
export function MealQueryField({
  value,
  onValueChange,
  ai,
  onSubmit,
  analyzing,
  inputRef,
}: {
  value: string;
  onValueChange: (value: string) => void;
  ai: boolean;
  onSubmit: () => void;
  analyzing: boolean;
  /** Le champ, pour que l'écran d'ajout y place le curseur. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("add");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`focus-within:outline-focus flex flex-col gap-2 rounded-2xl bg-surface px-4 focus-within:outline-3 ${
          ai ? "min-h-16 border-2 border-primary py-4" : "min-h-14 border border-border py-3.5"
        }`}
      >
        <label className="flex items-start gap-3">
          <span className={ai ? "text-primary" : "text-text-muted"}>
            <Icon name={ai ? "edit" : "search"} />
          </span>
          <span className="sr-only">{ai ? t("mealLabel") : t("searchLabel")}</span>
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(event) => onValueChange(event.target.value.replace(/\n/g, " "))}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (ai) onSubmit();
            }}
            maxLength={500}
            autoComplete="off"
            enterKeyHint={ai ? "go" : "search"}
            placeholder={ai ? t("mealLabel") : t("searchHint")}
            // Hauteur ajustée au texte (field-sizing) ; un navigateur sans support garde une ligne qui défile.
            className={`search-input [field-sizing:content] min-w-0 flex-1 resize-none bg-transparent leading-6 outline-none ${
              ai ? "text-lg font-semibold placeholder:text-text" : "text-base"
            }`}
          />
          {value && (
            <button
              type="button"
              aria-label={tCommon("clearSearch")}
              // Le champ garde le focus (et le clavier reste ouvert) au toucher.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange("");
                inputRef.current?.focus();
              }}
              className="search-clear -my-2 -me-2 flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted active:scale-90"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </label>
        {ai && value.trim().length >= 2 && (
          <Button onClick={onSubmit} disabled={analyzing} className="min-h-11 self-end px-5">
            {analyzing ? t("analyzing") : t("analyze")}
          </Button>
        )}
      </div>
      {ai && !value && <p className="px-1 text-sm text-text-muted">{t("mealHint")}</p>}
    </div>
  );
}
