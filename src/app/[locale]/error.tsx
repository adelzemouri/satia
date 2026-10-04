"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { CHUNK_RECOVERY_PATTERN } from "@/features/offline/chunk-recovery";
import { Button } from "@/ui/button";

declare global {
  interface Window {
    __recoverApp?: () => boolean;
  }
}

/** Écran affiché quand une page plante : on propose de recharger plutôt qu'un écran blanc. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("crash");
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
    </main>
  );
}
