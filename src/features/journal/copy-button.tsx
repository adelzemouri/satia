"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import type { MealSlot } from "@/domain/meals";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { copyEntriesAction } from "./actions";

/** Copie un repas (ou toute une journée si `fromSlot` est null) vers un autre jour. */
export function CopyButton({
  fromDate,
  fromSlot,
  toDate,
  label,
  compact = false,
}: {
  fromDate: string;
  fromSlot: MealSlot | null;
  toDate: string;
  label: string;
  /** Simple lien d'action, sans bouton encadré. */
  compact?: boolean;
}) {
  const t = useTranslations("journal");
  const errorText = useErrorText();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = () =>
    startTransition(async () => {
      const result = await copyEntriesAction({ fromDate, fromSlot, toDate, toSlot: null });
      setMessage(
        result?.error
          ? { ok: false, text: errorText(result.error) ?? "" }
          : { ok: true, text: t("copied", { count: result?.count ?? 0 }) },
      );
    });

  return (
    <div className="flex flex-col gap-2">
      {compact ? (
        <button
          type="button"
          onClick={copy}
          disabled={pending}
          className="min-h-11 shrink-0 font-semibold text-primary underline-offset-4 hover:underline"
        >
          {label}
        </button>
      ) : (
        <Button variant="secondary" onClick={copy} disabled={pending}>
          <Icon name="copy" />
          {label}
        </Button>
      )}
      {message && <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>}
    </div>
  );
}
