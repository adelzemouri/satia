"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { addEntryAction } from "@/features/journal/actions";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import {
  addPending,
  isNetworkFailure,
  markPendingFailed,
  type PendingEntry,
  readPending,
  removePending,
  subscribePending,
} from "./pending-queue";
import { postToWorker } from "./service-worker";

/** Pages gardées pour le hors-ligne dès l'ouverture de l'app : l'accueil, le journal du jour, l'ajout. */
const WARM_PAGES = ["/", "/journal", "/add"];
const WARMED_KEY = "satia.pages-warmed";

const OfflineContext = createContext<{ queue: (entry: Omit<PendingEntry, "id">) => void } | null>(null);

/** File d'attente des aliments notés sans réseau ; null hors de l'app connectée. */
export function useOfflineQueue() {
  return use(OfflineContext);
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * Mode hors ligne de l'app connectée : bandeau quand le réseau manque, aliments en attente
 * d'envoi, envoi automatique au retour de la connexion, et pages du jour gardées en cache.
 */
export function OfflineProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const queue = useCallback((entry: Omit<PendingEntry, "id">) => addPending(userId, entry), [userId]);
  return <OfflineContext value={{ queue }}>{children}</OfflineContext>;
}

export function OfflineStatus({ userId }: { userId: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const pending = useSyncExternalStore(
    subscribePending,
    () => readPending(userId),
    () => [],
  );
  const [syncing, setSyncing] = useState(false);
  const [sent, setSent] = useState(0);
  const running = useRef(false);

  const sync = useCallback(async (): Promise<number> => {
    if (running.current || !navigator.onLine) return 0;
    const toSend = readPending(userId).filter((entry) => !entry.error);
    if (toSend.length === 0) return 0;
    running.current = true;
    setSyncing(true);
    let count = 0;
    for (const entry of toSend) {
      try {
        const result = await addEntryAction({
          date: entry.date,
          slot: entry.slot,
          foodId: entry.foodId,
          quantity: entry.quantity,
          unit: entry.unit,
          inputMethod: entry.inputMethod,
        });
        if (result?.error) markPendingFailed(userId, entry.id, result.error);
        else {
          removePending(userId, entry.id);
          count += 1;
        }
      } catch (error) {
        // Le réseau est retombé : on reprendra au prochain retour de la connexion.
        if (isNetworkFailure(error)) break;
        markPendingFailed(userId, entry.id, "generic");
      }
    }
    running.current = false;
    setSyncing(false);
    if (count > 0) {
      setSent(count);
      router.refresh();
    }
    return count;
  }, [router, userId]);

  useEffect(() => {
    // Envoi au chargement (une file laissée par une visite précédente) puis à chaque retour du
    // réseau, où la page affichée (peut-être une version enregistrée) est aussi rafraîchie.
    const timer = window.setTimeout(() => void sync(), 0);
    const onOnline = async () => {
      if ((await sync()) === 0) router.refresh();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [router, sync]);

  useEffect(() => {
    // Une fois par session, et seulement en ligne, pour ne pas solliciter le serveur à chaque page.
    try {
      if (!navigator.onLine || sessionStorage.getItem(WARMED_KEY)) return;
      sessionStorage.setItem(WARMED_KEY, "1");
    } catch {
      return;
    }
    postToWorker({ type: "warm-pages", urls: WARM_PAGES });
  }, []);

  if (online && pending.length === 0 && sent === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {!online && <Alert tone="info">{t("offline.banner")}</Alert>}
      {sent > 0 && pending.length === 0 && <Alert tone="success">{t("offline.sent", { count: sent })}</Alert>}
      {pending.length > 0 && (
        <section
          aria-labelledby="pending-title"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
        >
          <h2 id="pending-title" className="font-semibold">
            {syncing ? t("offline.sending") : t("offline.pendingTitle", { count: pending.length })}
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {pending.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{entry.label}</span>
                  <span className="text-text-muted">
                    {" · "}
                    {entry.quantity} {t(`units.${entry.unit}`)} · {t(`slots.${entry.slot}`)} ·{" "}
                    {t("common.kcal", { value: entry.kcal })}
                  </span>
                  {entry.error && <span className="block text-sm">{errorText(entry.error)}</span>}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`${t("offline.remove")} ${entry.label}`}
                  onClick={() => removePending(userId, entry.id)}
                >
                  {t("offline.remove")}
                </Button>
              </li>
            ))}
          </ul>
          {online && !syncing && pending.some((entry) => !entry.error) && (
            <Button variant="secondary" onClick={() => void sync()}>
              {t("offline.retry")}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
