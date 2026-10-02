"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Icon } from "@/ui/icon";

import { deleteSessionAction } from "./actions";

export function DeleteSessionButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("training.history");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteSessionAction(id)))}
      aria-label={t("deleteLabel", { date: label })}
      className="flex size-12 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
    >
      <Icon name="trash" />
    </button>
  );
}
