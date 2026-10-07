"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { PASSWORD_RESET_TTL_HOURS } from "@/config/app";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { createResetLinkAction, removeMemberAction } from "./actions";
import { CopyLink } from "./copy-link";

export function MemberActions({
  userId,
  name,
  isSelf,
  guest = false,
}: {
  userId: string;
  name: string;
  isSelf: boolean;
  guest?: boolean;
}) {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createResetLinkAction(userId);
              setUrl(result?.url ?? null);
              setError(result?.error ?? null);
            })
          }
        >
          {t("resetLink")}
        </Button>
        {!isSelf && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t(guest ? "guestRemoveConfirm" : "removeConfirm", { name }))) return;
              startTransition(async () => {
                const result = await removeMemberAction(userId);
                setError(result?.error ?? null);
              });
            }}
          >
            {t("remove")}
          </Button>
        )}
      </div>
      {error && <Alert>{errorText(error)}</Alert>}
      {url && <CopyLink intro={t("resetReady", { hours: PASSWORD_RESET_TTL_HOURS })} url={url} />}
    </div>
  );
}
