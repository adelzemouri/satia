"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { deleteFoodAction } from "@/features/journal/actions";
import { Alert } from "@/ui/alert";
import { Icon } from "@/ui/icon";

export function DeleteFoodButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("foods");
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label={t("delete", { name })}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteFoodAction(id);
            setError(result?.error ?? null);
          })
        }
        className="flex size-12 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
      >
        <Icon name="trash" />
      </button>
      {error && (
        <div className="basis-full">
          <Alert>{errorText(error)}</Alert>
        </div>
      )}
    </>
  );
}
