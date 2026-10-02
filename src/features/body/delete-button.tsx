"use client";

import { useTransition } from "react";

import type { ActionState } from "@/server/action-result";
import { Icon } from "@/ui/icon";

/** Bouton corbeille pour une action serveur déjà liée à son élément. */
export function DeleteButton({ label, action }: { label: string; action: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(async () => void (await action()))}
      className="flex size-12 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
    >
      <Icon name="trash" />
    </button>
  );
}
