"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Icon } from "@/ui/icon";

import { removePlanItemAction } from "./actions";

export function RemovePlanItem({ id, name }: { id: string; name: string }) {
  const t = useTranslations("plan");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(async () => void (await removePlanItemAction(id)))}
      disabled={pending}
      aria-label={t("removeLabel", { name })}
      className="flex size-12 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted disabled:opacity-60"
    >
      <Icon name="trash" />
    </button>
  );
}
