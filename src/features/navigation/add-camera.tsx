"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { slotAt } from "@/domain/meals";
import { requestQuickStart } from "@/features/ai/quick-start";
import { useErrorText } from "@/features/auth/use-error-text";
import { FoodList } from "@/features/foods/food-list";
import type { RecentItem } from "@/features/foods/food-types";
import { QuickAddButton } from "@/features/foods/quick-add-button";
import { recentFoodsAction, scanBarcodeAction } from "@/features/journal/actions";
import { captureFrame, useBarcodeDetection, useCameraStream } from "@/features/scan/use-camera";
import { Link, useRouter } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";

type Mode = "photo" | "barcode";

const ROUND = "flex size-11 shrink-0 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md";
const SIDE =
  "flex size-13 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/15 text-white transition-transform duration-[120ms] ease-out-strong active:scale-[0.94] focus-within:outline-2 focus-visible:outline-2";
const PILL = "flex h-9 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap";

/**
 * L'appareil photo du + : la caméra s'ouvre tout de suite, avec en bas les façons d'ajouter
 * (photo, code-barres, voix, recherche) et en haut les aliments récents. Sans IA configurée, il
 * s'ouvre sur le code-barres et la photo et la voix disparaissent.
 */
export function AddCamera({ ai, onClose }: { ai: boolean; onClose: () => void }) {
  const t = useTranslations("camera");
  const tNav = useTranslations("nav");
  const tScan = useTranslations("scan");
  const tAdd = useTranslations("add");
  const tAll = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>(ai ? "photo" : "barcode");
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<RecentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookingUp, startLookUp] = useTransition();
  // Repas et jour pris au moment de l'ouverture, comme l'écran d'ajout le ferait.
  const [{ date, slot }] = useState(() => ({ date: todayIso(), slot: slotAt(new Date(), APP_TIMEZONE) }));

  const { video, status, torch, toggleTorch } = useCameraStream(true);
  const ready = status === "ready";

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    // La page derrière ne défile pas pendant que la caméra est ouverte (iOS ignore le dialogue modal).
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
      if (element.open) element.close();
    };
  }, []);

  const lookUp = useCallback(
    (code: string) => {
      haptic();
      setError(null);
      startLookUp(async () => {
        const result = await scanBarcodeAction(code);
        if (result?.id) {
          onClose();
          router.push({ pathname: `/foods/${result.id}`, query: { date, slot, via: "barcode" } });
        } else {
          setError(result?.error ?? "generic");
        }
      });
    },
    [date, slot, onClose, router],
  );
  useBarcodeDetection(video, mode === "barcode" && ready && !error && !lookingUp, lookUp);

  const openRecent = () => {
    setRecentOpen(true);
    if (!recent) void recentFoodsAction().then(setRecent, () => setRecent([]));
  };

  const sendPhoto = (file: File) => {
    onClose();
    requestQuickStart({ kind: "photo", file });
    router.push("/add");
  };

  const shoot = async () => {
    const element = video.current;
    const file = element ? await captureFrame(element) : null;
    if (!file) return;
    haptic();
    sendPhoto(file);
  };

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) sendPhoto(file);
  };

  const startAi = (kind: "voice" | "write") => {
    onClose();
    requestQuickStart({ kind });
    router.push("/add");
  };

  const pickMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const problem = status === "denied" || status === "unsupported";
  const hint = lookingUp
    ? tScan("searching")
    : status === "starting"
      ? t("starting")
      : problem
        ? t(mode === "photo" ? "photoUnavailable" : "barcodeUnavailable")
        : t(mode === "photo" ? "photoHint" : "barcodeHint");

  return (
    <dialog
      ref={dialog}
      aria-label={tNav("addMeal")}
      onCancel={(event) => {
        event.preventDefault();
        if (recentOpen) setRecentOpen(false);
        else onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-black p-0 text-white backdrop:bg-black open:block motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out-strong motion-safe:starting:opacity-0"
    >
      <video
        ref={video}
        muted
        playsInline
        aria-hidden="true"
        className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
      />

      {mode === "barcode" && ready && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] top-[42%] h-32 -translate-y-1/2 rounded-3xl border-[3px] border-white shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]"
        />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={openRecent}
          aria-haspopup="dialog"
          className="flex h-11 items-center gap-2 rounded-full bg-black/55 pr-4 pl-3 font-bold text-white backdrop-blur-md"
        >
          <Icon name="clock" size={20} />
          {t("recent")}
          <Icon name="down" size={16} />
        </button>
        <div className="flex gap-2">
          {torch.available && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={torch.on}
              aria-label={t("torch")}
              className={`${ROUND} ${torch.on ? "bg-white text-black" : ""}`}
            >
              <Icon name="flash" size={20} filled={torch.on} />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={t("close")} className={ROUND}>
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-black/75 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
        <p aria-live="polite" className="max-w-sm text-center text-sm font-semibold text-white/90">
          {error ? errorText(error) : hint}
        </p>

        {error ? (
          <div className="flex flex-wrap justify-center gap-2">
            {error === "barcode_not_found" && (
              <>
                <Link href="/foods/new" onClick={onClose} className={`${PILL} bg-white text-black`}>
                  {tScan("createFood")}
                </Link>
                <Link
                  href={{ pathname: "/add", query: { date, slot } }}
                  onClick={onClose}
                  className={`${PILL} bg-white/15`}
                >
                  {tScan("searchByName")}
                </Link>
              </>
            )}
            <button type="button" onClick={() => setError(null)} className={`${PILL} bg-white/15`}>
              {tScan("again")}
            </button>
          </div>
        ) : null}

        <nav aria-label={t("modes")} className="flex justify-center gap-1">
          {ai && (
            <button
              type="button"
              aria-pressed={mode === "photo"}
              onClick={() => pickMode("photo")}
              className={`${PILL} ${mode === "photo" ? "bg-primary text-on-primary" : "text-white/85"}`}
            >
              {tNav("addPhoto")}
            </button>
          )}
          <button
            type="button"
            aria-pressed={mode === "barcode"}
            onClick={() => pickMode("barcode")}
            className={`${PILL} ${mode === "barcode" ? "bg-primary text-on-primary" : "text-white/85"}`}
          >
            {tNav("addBarcode")}
          </button>
          {ai && (
            <button type="button" onClick={() => startAi("voice")} className={`${PILL} text-white/85`}>
              {tNav("addVoice")}
            </button>
          )}
          <Link
            href={{ pathname: "/add", query: { date, slot } }}
            onClick={onClose}
            className={`${PILL} text-white/85`}
          >
            {tNav("addSearch")}
          </Link>
        </nav>

        {mode === "photo" ? (
          <div className="flex w-full max-w-sm items-center justify-between px-4">
            <label className={SIDE}>
              <Icon name="image" size={24} />
              <span className="sr-only">{t("gallery")}</span>
              <input type="file" accept="image/*" onChange={pickFile} className="sr-only" />
            </label>
            {problem ? (
              // Sans accès direct à la caméra, le déclencheur ouvre l'appareil photo du téléphone.
              <label className="flex size-20 cursor-pointer rounded-full border-4 border-white p-1.5 focus-within:outline-2">
                <span className="flex-1 rounded-full bg-white" />
                <span className="sr-only">{t("shutter")}</span>
                <input type="file" accept="image/*" capture="environment" onChange={pickFile} className="sr-only" />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => void shoot()}
                disabled={!ready}
                aria-label={t("shutter")}
                className="group flex size-20 rounded-full border-4 border-white p-1.5 disabled:opacity-50"
              >
                <span className="flex-1 rounded-full bg-white transition-transform duration-[120ms] ease-out-strong group-active:scale-[0.88]" />
              </button>
            )}
            <button type="button" onClick={() => startAi("write")} aria-label={t("write")} className={SIDE}>
              <Icon name="edit" size={24} />
            </button>
          </div>
        ) : (
          <div className="flex h-20 items-center">
            <Link
              href={{ pathname: "/scan", query: { date, slot } }}
              onClick={onClose}
              className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold"
            >
              <Icon name="edit" size={20} />
              {t("typeCode")}
            </Link>
          </div>
        )}
      </div>

      {recentOpen && (
        <>
          <div aria-hidden="true" onClick={() => setRecentOpen(false)} className="absolute inset-0 bg-black/40" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-recent-title"
            className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col gap-3 rounded-t-[1.75rem] bg-bg px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-text motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-strong motion-safe:starting:translate-y-full"
          >
            <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between gap-3">
              <h2 id="camera-recent-title" className="font-display text-2xl font-extrabold tracking-tight">
                {t("recent")}
              </h2>
              <button
                type="button"
                onClick={() => setRecentOpen(false)}
                aria-label={t("recentClose")}
                className="flex size-11 items-center justify-center rounded-full bg-surface-muted"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <p className="text-sm text-text-muted">{t("recentHint", { slot: tAll(`slotsLower.${slot}`) })}</p>
            <div className="min-h-0 overflow-y-auto rounded-[var(--radius-card)] bg-surface px-3">
              {recent === null ? (
                <p className="py-6 text-center text-text-muted">{t("recentLoading")}</p>
              ) : recent.length === 0 ? (
                <p className="py-6 text-center text-text-muted">{t("recentEmpty")}</p>
              ) : (
                <FoodList
                  foods={recent}
                  favoriteIds={new Set()}
                  onSelect={(food) => {
                    onClose();
                    router.push({ pathname: "/add", query: { food: food.id, date, slot } });
                  }}
                  trailing={(food) => (
                    <QuickAddButton
                      food={recent.find((item) => item.id === food.id)!}
                      date={date}
                      slot={slot}
                      onError={setError}
                      onAdded={onClose}
                    />
                  )}
                  describe={(food) => {
                    const item = recent.find((value) => value.id === food.id)!;
                    return tAdd("lastPortion", {
                      quantity: item.lastQuantity,
                      unit: tAll(`units.${item.lastUnit}`),
                      kcal: Math.round(item.lastKcal),
                    });
                  }}
                />
              )}
            </div>
          </section>
        </>
      )}
    </dialog>
  );
}
