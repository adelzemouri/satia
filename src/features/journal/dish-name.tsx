"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";

import { DISH_MAX_LENGTH } from "@/domain/dishes";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { renameDishAction } from "./actions";

/**
 * Nom d'un plat avec un crayon pour le renommer sur place. `onSave` renvoie une clé d'erreur,
 * ou null quand le nouveau nom est enregistré.
 */
export function DishName({
  name,
  heading = false,
  trailing,
  onSave,
}: {
  name: string;
  /** Le nom est le titre de sa section (écran de vérification). */
  heading?: boolean;
  /** Affiché au bout de la ligne (kcal du plat), masqué pendant la saisie du nom. */
  trailing?: ReactNode;
  onSave: (name: string) => Promise<string | null> | string | null;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const close = () => {
    setEditing(false);
    setError(null);
    // Le focus revient au crayon, pour qui navigue au clavier.
    requestAnimationFrame(() => pencil.current?.focus());
  };

  const save = () => {
    const next = value.trim();
    if (!next || next === name) return close();
    startTransition(async () => {
      const failure = await onSave(next);
      if (failure) setError(failure);
      else close();
    });
  };

  if (!editing)
    return (
      <div className="flex min-w-0 items-center gap-1">
        {heading ? <h3 className="min-w-0 truncate">{name}</h3> : <span className="min-w-0 truncate">{name}</span>}
        <button
          ref={pencil}
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          aria-label={t("dish.rename", { name })}
          className="-my-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
        >
          <Icon name="edit" size={18} />
        </button>
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>
    );

  return (
    // Pas de <form> : sur l'écran de vérification, le nom est déjà dans le formulaire du repas.
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-text-muted">
        {t("dish.label")}
      </label>
      <input
        ref={input}
        id={inputId}
        value={value}
        maxLength={DISH_MAX_LENGTH}
        enterKeyHint="done"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        className="min-h-12 rounded-2xl border-2 border-primary bg-surface px-3 text-base font-normal text-text"
      />
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="flex gap-2">
        <Button className="min-h-11 px-5 text-sm" disabled={pending || !value.trim()} onClick={save}>
          {t("common.save")}
        </Button>
        <Button variant="ghost" className="min-h-11 px-5 text-sm" onClick={close}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/** Nom d'un plat du journal : le renommer met à jour toutes ses lignes. */
export function JournalDishName({ name, ids, trailing }: { name: string; ids: string[]; trailing?: ReactNode }) {
  return (
    <DishName
      name={name}
      trailing={trailing}
      onSave={async (dish) => (await renameDishAction({ ids, dish }))?.error ?? null}
    />
  );
}
