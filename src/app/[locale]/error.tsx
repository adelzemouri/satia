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

/** Une seule relance automatique par période, pour ne jamais boucler sur une erreur durable. */
const AUTO_RETRY_KEY = "pommelia-error-retried-at";
const AUTO_RETRY_GAP_MS = 30_000;

function claimAutoRetry(): boolean {
  try {
    const last = Number(sessionStorage.getItem(AUTO_RETRY_KEY)) || 0;
    if (Date.now() - last < AUTO_RETRY_GAP_MS) return false;
    sessionStorage.setItem(AUTO_RETRY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Écran affiché quand une page plante : on propose de recharger plutôt qu'un écran blanc.
 * Une erreur du serveur (base qui se réveille, coupure passagère) porte un `digest` : on redemande
 * la page une fois, sans rien afficher d'alarmant, avant de montrer l'écran d'erreur.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
}) {
  const t = useTranslations("crash");
  const tf = useTranslations("feedback");
  const pathname = usePathname();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  // Fichiers d'une ancienne version : un rechargement suffit, sans rien demander.
  const staleVersion = CHUNK_RECOVERY_PATTERN.test(`${error.name} ${error.message}`);
  const [retrying, setRetrying] = useState(Boolean(error.digest) && !staleVersion);

  useEffect(() => {
    if (staleVersion) window.__recoverApp?.();
  }, [staleVersion]);

  useEffect(() => {
    if (!retrying) return;
    if (claimAutoRetry()) retry();
    // sessionStorage n'existe qu'au navigateur : la décision ne peut se prendre qu'ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setRetrying(false);
    // Une fois par affichage de l'écran : la relance elle-même ne doit pas en déclencher une autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (retrying) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6 text-center">
        <p role="status" className="text-text-muted">
          {t("retrying")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{staleVersion ? t("recovering") : t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{t("reload")}</Button>
        {/* `retry` redemande la page au serveur ; `reset` ne ferait que réafficher la même erreur. */}
        <Button variant="secondary" onClick={retry}>
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
