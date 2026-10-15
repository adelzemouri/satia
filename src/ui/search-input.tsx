"use client";

import { useTranslations } from "next-intl";
import { useRef, type InputHTMLAttributes } from "react";

import { Icon } from "./icon";

/**
 * Champ de recherche avec une croix pour l'effacer, visible dès qu'il contient du texte.
 * À placer dans un conteneur `flex items-center` qui porte la bordure et l'anneau de focus (focus-within).
 * La croix garde le focus dans le champ : sur téléphone, le clavier reste ouvert.
 */
export function SearchInput({
  value,
  onValueChange,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("common");
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`search-input min-w-0 flex-1 bg-transparent text-base ${className}`}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={t("clearSearch")}
          // Empêche le champ de perdre le focus (et le clavier de se fermer) au toucher.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange("");
            input.current?.focus();
          }}
          className="search-clear -me-2 flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted active:scale-90"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </>
  );
}
