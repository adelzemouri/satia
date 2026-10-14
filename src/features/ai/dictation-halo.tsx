"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

/** Ondes affichées en même temps : les plus anciennes ont fini leur animation. */
const WAVES = 3;

/**
 * L'écran de la dictée. Pendant l'écoute, la phrase reconnue s'écrit en grand, le micro respire et
 * lance une onde à chaque nouveau mot. L'animation suit les mots renvoyés par la reconnaissance
 * vocale, sans ouvrir le micro une seconde fois (ce qui gênerait la dictée sur iPhone).
 *
 * Quand la dictée s'arrête (silence, arrêt ou micro qui décroche), la phrase reste affichée et le
 * micro devient un bouton pour compléter ou réessayer : ce toucher est le geste que Safari demande
 * pour rouvrir le micro.
 */
export function DictationHalo({
  text,
  listening,
  error,
  onMic,
}: {
  text: string;
  listening: boolean;
  /** Message d'erreur de la dictée, déjà traduit. */
  error: string | null;
  onMic: () => void;
}) {
  const t = useTranslations("aiEntry");
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const count = words.length;

  const status = listening ? t("listening") : error ? t("interrupted") : count ? t("heard") : t("ready");
  const hint = error ? t("tapToRetry") : count ? t("tapToAdd") : t("tapToSpeak");
  const micLabel = error ? t("micRetry") : count ? t("micAdd") : t("micStart");

  return (
    <div
      role="group"
      aria-label={listening ? t("listeningLabel") : t("dictationLabel")}
      className="flex flex-1 flex-col items-center gap-4 py-2"
    >
      <p className="text-xs font-bold tracking-wider text-primary uppercase">{status}</p>
      <p aria-live="polite" className="min-h-20 text-center font-display text-3xl leading-tight font-bold text-balance">
        {count === 0 ? (
          <span className="font-semibold text-text-muted">{t("listeningHint")}</span>
        ) : (
          words.map((word, index) => (
            <span key={index}>
              <span className="dictation-word inline-block">{word}</span>{" "}
            </span>
          ))
        )}
      </p>
      {listening ? (
        <div aria-hidden="true" className="relative grid min-h-48 flex-1 place-items-center">
          {/* Une onde par mot reçu : chacune part du micro à son montage, puis s'efface. */}
          {Array.from({ length: Math.min(count, WAVES) }, (_, index) => count - index).map((n) => (
            <span key={n} className="dictation-wave absolute size-24 rounded-full border-[3px] border-primary" />
          ))}
          <span className="dictation-breathe relative flex size-24 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30">
            <span key={count} className="dictation-bump flex">
              <Icon name="mic" size={36} />
            </span>
          </span>
        </div>
      ) : (
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={onMic}
            aria-label={micLabel}
            className="flex size-24 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform active:scale-95"
          >
            <Icon name="mic" size={36} />
          </button>
          <p className="text-sm text-text-muted">{hint}</p>
          {error && (
            <p
              role="alert"
              className="max-w-72 rounded-xl bg-surface-muted px-3 py-2 text-center text-sm font-semibold"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * La dictée en plein écran sur téléphone, comme une page à part : la phrase en grand au centre, le
 * micro dessous et les boutons à portée du pouce. La barre du bas et la recherche sont cachées
 * pendant ce temps. Sur ordinateur, c'est un panneau centré au-dessus de la page.
 */
export function DictationScreen({
  title,
  onClose,
  action,
  text,
  listening,
  error,
  pending,
  onMic,
  onStop,
  onEdit,
}: {
  title?: ReactNode;
  onClose: () => void;
  action: () => void;
  text: string;
  listening: boolean;
  error: string | null;
  pending: boolean;
  onMic: () => void;
  onStop: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("aiEntry");
  const panel = useRef<HTMLDivElement>(null);
  const ready = text.trim().length >= 2;

  // Pendant la dictée, la page derrière ne défile plus et Échap referme.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-bg lg:items-center lg:justify-center lg:bg-bg/70 lg:p-6 lg:backdrop-blur-[3px]">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t("dictationLabel")}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none lg:min-h-[36rem] lg:rounded-[var(--radius-card)] lg:bg-surface lg:p-6 lg:shadow-xl"
      >
        {title}
        <form action={action} className="flex flex-1 flex-col gap-4">
          <DictationHalo text={text} listening={listening} error={error} onMic={onMic} />
          {listening ? (
            // Clés distinctes : sinon React réutiliserait le bouton « Arrêter » touché pour en faire
            // « Analyser » (type submit) pendant le clic, et le formulaire partirait aussitôt.
            <div key="listening" className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onStop} aria-label={t("stopDictation")}>
                {t("stop")}
              </Button>
              <Button type="submit" disabled={pending || !ready}>
                {t("analyzeText")}
              </Button>
            </div>
          ) : (
            <div key="stopped" className="flex flex-col gap-1">
              <Button type="submit" disabled={pending || !ready} className="min-h-14 w-full text-lg">
                {pending ? t("analyzing") : t("analyzeText")}
              </Button>
              <p className="flex justify-center gap-x-6 text-sm font-semibold text-primary">
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={pending}
                  className="min-h-11 underline underline-offset-4"
                >
                  {t("editText")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="min-h-11 underline-offset-4 hover:underline"
                >
                  {t("cancel")}
                </button>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
