"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";

import { deleteSavedMealAction } from "./actions";

/**
 * Carte d'un repas enregistré avec son bouton de suppression : la carte disparaît tout de suite,
 * la suppression n'est faite qu'à la fin du délai d'annulation.
 */
export function SavedMealItem({
  id,
  name,
  canShare,
  children,
}: {
  id: string;
  name: string;
  /** Faux quand on est seul au foyer : rien à partager. */
  canShare: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("savedMeals");
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const remove = () => {
    setHidden(true);
    toast({
      message: t("deleted", { name }),
      undo: () => setHidden(false),
      onExpire: () =>
        void deleteSavedMealAction(id).then((result) => {
          if (result?.error) setHidden(false);
        }),
    });
  };

  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {canShare && (
        <Link
          href={`/meals/${id}/share`}
          aria-label={t("share", { name })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
        >
          <Icon name="share" size={20} />
        </Link>
      )}
      <Link
        href={`/meals/${id}`}
        aria-label={t("edit", { name })}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
      >
        <Icon name="edit" size={20} />
      </Link>
      <button
        type="button"
        onClick={remove}
        aria-label={t("delete", { name })}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
      >
        <Icon name="trash" size={20} />
      </button>
    </li>
  );
}
