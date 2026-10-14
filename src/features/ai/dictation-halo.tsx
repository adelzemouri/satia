"use client";

import { useTranslations } from "next-intl";

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
      className="flex flex-col items-center gap-4 py-2"
    >
      <p className="text-xs font-bold tracking-wider text-primary uppercase">{status}</p>
      <p aria-live="polite" className="min-h-20 text-center font-display text-2xl leading-tight font-bold text-balance">
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
        <div aria-hidden="true" className="relative grid size-40 place-items-center">
          {/* Une onde par mot reçu : chacune part du micro à son montage, puis s'efface. */}
          {Array.from({ length: Math.min(count, WAVES) }, (_, index) => count - index).map((n) => (
            <span key={n} className="dictation-wave absolute size-20 rounded-full border-[3px] border-primary" />
          ))}
          <span className="dictation-breathe relative flex size-20 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30">
            <span key={count} className="dictation-bump flex">
              <Icon name="mic" size={36} />
            </span>
          </span>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={onMic}
            aria-label={micLabel}
            className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform active:scale-95"
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
