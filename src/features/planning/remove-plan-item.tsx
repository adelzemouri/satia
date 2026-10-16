"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Icon } from "@/ui/icon";

import { removePlanItemAction } from "./actions";

/** `compact` : bouton plus petit, pour les cases du tableau de la semaine sur ordinateur. */
export function RemovePlanItem({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const t = useTranslations("plan");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(async () => void (await removePlanItemAction(id)))}
      disabled={pending}
      aria-label={t("removeLabel", { name })}
      className={`flex ${compact ? "size-9" : "size-12"} shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted disabled:opacity-60`}
    >
      <Icon name="trash" />
    </button>
  );
}
