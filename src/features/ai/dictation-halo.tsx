"use client";

import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icon";

/** Ondes affichées en même temps : les plus anciennes ont fini leur animation. */
const WAVES = 3;

/**
 * Pendant la dictée : la phrase reconnue s'écrit en grand, le micro respire et lance une onde à
 * chaque nouveau mot. L'animation suit les mots renvoyés par la reconnaissance vocale, sans
 * ouvrir le micro une seconde fois (ce qui gênerait la dictée sur iPhone).
 */
export function DictationHalo({ text }: { text: string }) {
  const t = useTranslations("aiEntry");
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const count = words.length;

  return (
    <div role="group" aria-label={t("listeningLabel")} className="flex flex-col items-center gap-4 py-2">
      <p className="text-xs font-bold tracking-wider text-primary uppercase">{t("listening")}</p>
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
    </div>
  );
}
