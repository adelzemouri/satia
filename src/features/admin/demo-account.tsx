"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { deleteDemoAction, type DemoState, fillDemoAction, resetDemoAction } from "./actions";

export function DemoAccount({ email, createdOn }: { email: string; createdOn: string | null }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [result, setResult] = useState<DemoState>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const credentials = result?.password ? result : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted">{t("demoHint")}</p>
      <p>{createdOn ? t("demoStatus", { email, date: createdOn }) : t("demoNone")}</p>
      <div className="flex flex-wrap gap-2">
        {createdOn && (
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setResult(await fillDemoAction());
              });
            }}
          >
            {t("demoFill")}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (createdOn && !window.confirm(t("demoResetConfirm"))) return;
            startTransition(async () => {
              setCopied(false);
              setResult(await resetDemoAction());
            });
          }}
        >
          {createdOn ? t("demoReset") : t("demoCreate")}
        </Button>
        {createdOn && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t("demoDeleteConfirm"))) return;
              startTransition(async () => {
                setResult(await deleteDemoAction());
              });
            }}
          >
            {t("demoDelete")}
          </Button>
        )}
      </div>
      {result?.error && <Alert>{errorText(result.error)}</Alert>}
      {result?.filledDays !== undefined && (
        <Alert tone="success">{t("demoFilled", { count: result.filledDays })}</Alert>
      )}
      {credentials && (
        <div className="flex flex-col gap-2 rounded-2xl bg-primary-soft p-4" role="status">
          <p className="font-semibold">{t("demoReady")}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-text-muted">{t("demoAddress")}</dt>
            <dd className="break-all">{credentials.loginUrl}</dd>
            <dt className="text-text-muted">{t("demoEmail")}</dt>
            <dd className="break-all">{credentials.email}</dd>
            <dt className="text-text-muted">{t("demoPassword")}</dt>
            <dd>
              <code className="rounded-lg bg-surface px-2 py-0.5">{credentials.password}</code>
            </dd>
          </dl>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(
                t("demoCopyText", {
                  url: credentials.loginUrl ?? "",
                  email: credentials.email ?? "",
                  password: credentials.password ?? "",
                }),
              );
              setCopied(true);
            }}
          >
            {copied ? tc("copied") : tc("copy")}
          </Button>
        </div>
      )}
    </div>
  );
}
