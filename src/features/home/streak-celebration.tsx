"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { CoachAvatar } from "@/features/coach/coach-avatar";
import { haptic } from "@/ui/motion";

/** Confettis en pépins et en feuilles : positions fixes, pour un rendu identique à chaque fois. */
const CONFETTI = Array.from({ length: 22 }, (_, index) => ({
  left: (index * 37) % 100,
  delay: -((index * 0.41) % 3.4),
  rest: (index * 53) % 92,
  kind: (["seed", "leaf", "light"] as const)[index % 3],
}));

const STORAGE_PREFIX = "pommelia:celebrated:";

/**
 * Plein écran court pour un palier de série (3, 7, 14, 30… jours) : montré une seule fois par
 * palier et par jour sur cet appareil, puis l'accueil reprend. Jamais pour un simple repas noté.
 */
export function StreakCelebration({ days, date }: { days: number; date: string }) {
  const t = useTranslations("home.celebration");
  return (
    <Celebration
      storageKey={`${days}:${date}`}
      hero={<p className="font-display text-[9rem] leading-[0.8] font-extrabold tracking-tight">{days}</p>}
      title={t("title", { days })}
      body={t("body")}
    />
  );
}

/**
 * Célébration plein écran (série, victoire de régularité) : montrée une seule fois par clé sur
 * cet appareil, fermée par le bouton ou Échap.
 */
export function Celebration({
  storageKey,
  hero,
  eyebrow,
  title,
  body,
}: {
  storageKey: string;
  hero?: ReactNode;
  eyebrow?: string;
  title: string;
  body: string;
}) {
  const t = useTranslations("home.celebration");
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const key = `${STORAGE_PREFIX}${storageKey}`;

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(key) !== null;
      localStorage.setItem(key, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on célèbre quand même, une fois par visite.
    }
    if (seen) return;
    // Ouvert après le premier rendu, sur cet appareil seulement (le serveur ne sait pas ce qui a été vu).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    haptic([20, 60, 30]);
  }, [key]);

  useEffect(() => {
    if (!open) return;
    button.current?.focus({ focusVisible: false } as FocusOptions);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="celebration fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-hidden bg-pomme px-8 pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))] text-center text-on-pomme"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CONFETTI.map((piece, index) => (
          <span
            key={index}
            className={`confetti confetti-${piece.kind}`}
            style={
              {
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                "--rest": `${piece.rest}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <span className="rounded-full bg-on-pomme/90 p-1">
          <CoachAvatar size={64} />
        </span>
        {hero}
        {eyebrow && <p className="text-sm font-extrabold tracking-wider uppercase opacity-90">{eyebrow}</p>}
        <h2 id="celebration-title" className="font-display text-3xl font-extrabold tracking-tight text-balance">
          {title}
        </h2>
        <p className="max-w-xs">{body}</p>
      </div>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(false)}
        className="relative mt-4 min-h-12 w-full max-w-xs rounded-full bg-on-pomme px-6 font-bold text-pomme"
      >
        {t("continue")}
      </button>
    </div>
  );
}
