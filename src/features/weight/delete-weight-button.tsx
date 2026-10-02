"use client";

import { useTransition } from "react";

import { deleteWeightAction } from "@/features/journal/actions";
import { Icon } from "@/ui/icon";

export function DeleteWeightButton({ date, label }: { date: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteWeightAction(date)))}
      className="flex size-12 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
    >
      <Icon name="trash" />
    </button>
  );
}
