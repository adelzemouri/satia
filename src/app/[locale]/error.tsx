"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { FeedbackForm } from "@/features/feedback/feedback-form";
import { CHUNK_RECOVERY_PATTERN } from "@/features/offline/chunk-recovery";
import { usePathname } from "@/i18n/navigation";
import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";

declare global {
  interface Window {
    __recoverApp?: () => boolean;
  }
}

/** Écran affiché quand une page plante : on propose de recharger plutôt qu'un écran blanc. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("crash");
  const tf = useTranslations("feedback");
  const pathname = usePathname();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  // Fichiers d'une ancienne version : un rechargement suffit, sans rien demander.
  const staleVersion = CHUNK_RECOVERY_PATTERN.test(`${error.name} ${error.message}`);

  useEffect(() => {
    if (staleVersion) window.__recoverApp?.();
  }, [staleVersion]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{staleVersion ? t("recovering") : t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{t("reload")}</Button>
        <Button variant="secondary" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
      {!staleVersion &&
        (reported ? (
          <p role="status" className="text-sm font-semibold text-primary">
            {tf("errorSent")}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="min-h-11 rounded-full px-4 font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tf("bugTitle")}
          </button>
        ))}
      <Sheet open={reporting} onClose={() => setReporting(false)} title={tf("bugTitle")} closeLabel={tf("close")}>
        <FeedbackForm
          page={pathname}
          defaultKind="bug"
          errorDetail={[error.digest && `digest ${error.digest}`, `${error.name}: ${error.message}`]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 1000)}
          onSent={() => {
            setReporting(false);
            setReported(true);
          }}
        />
      </Sheet>
    </main>
  );
}
