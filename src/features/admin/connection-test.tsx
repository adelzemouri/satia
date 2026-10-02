"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { type ConnectionTestState, testConnectionAction } from "./ai-actions";
import { formatUsd } from "./format-usd";

/** Petit appel réel au fournisseur pour vérifier la clé et les modèles. */
export function ConnectionTest({ disabled }: { disabled: boolean }) {
  const t = useTranslations("aiAdmin");
  const format = useFormatter();
  const errorText = useErrorText();
  const [state, setState] = useState<ConnectionTestState>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        disabled={disabled || pending}
        onClick={() => startTransition(async () => setState(await testConnectionAction()))}
      >
        {pending ? t("testing") : t("test")}
      </Button>
      <div aria-live="polite">
        {state && "error" in state && <Alert>{errorText(state.error)}</Alert>}
        {state && "results" in state && (
          <Alert tone="success">
            {state.results.map((result) => (
              <span key={result.kind} className="block">
                {t("testOk", {
                  kind: t(`kind.${result.kind}`),
                  model: result.model,
                  ms: result.latencyMs,
                  tokens: result.tokens,
                  cost: formatUsd(format, result.costUsdMicros),
                })}
              </span>
            ))}
          </Alert>
        )}
      </div>
    </div>
  );
}
