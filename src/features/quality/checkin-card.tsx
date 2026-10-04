"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { haptic } from "@/ui/motion";

import { setCheckinAction } from "./actions";

const QUESTIONS = ["hunger", "energy", "mood"] as const;
type Question = (typeof QUESTIONS)[number];
const SCALE = [1, 2, 3, 4, 5] as const;

/**
 * Ressenti du jour (facultatif, privé) : une question à la fois, chaque réponse dessinée (jauge de
 * faim, pile d'énergie, visage d'humeur). Enregistré à chaque choix, puis passage à la suivante.
 */
export function CheckinCard({ date, initial }: { date: string; initial: Record<Question, number | null> }) {
  const t = useTranslations("checkin");
  const errorText = useErrorText();
  const [values, setValues] = useState(initial);
  const [active, setActive] = useState<Question>(() => QUESTIONS.find((q) => initial[q] === null) ?? "hunger");
  const [popped, setPopped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(advance.current), []);

  const done = QUESTIONS.every((q) => values[q] !== null);

  const choose = (question: Question, value: number) => {
    const next = { ...values, [question]: value };
    setValues(next);
    setPopped(`${question}-${value}`);
    haptic();
    startTransition(async () => {
      const result = await setCheckinAction({ date, [question]: value });
      setError(result?.error ?? null);
    });
    // Après un court instant, on enchaîne sur la prochaine question sans réponse.
    const following = QUESTIONS.find((q, index) => index > QUESTIONS.indexOf(question) && next[q] === null);
    clearTimeout(advance.current);
    if (following) advance.current = setTimeout(() => setActive(following), 450);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-3 gap-2">
        {QUESTIONS.map((question) => {
          const value = values[question];
          return (
            <button
              key={question}
              type="button"
              aria-pressed={active === question}
              aria-label={
                value === null ? t(`${question}.label`) : t("scaleValue", { question: t(`${question}.label`), value })
              }
              onClick={() => setActive(question)}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full border px-2 text-sm font-semibold transition ${
                active === question ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
              }`}
            >
              <span aria-hidden className={`size-6 ${value === null ? "opacity-40" : ""}`}>
                <Glyph question={question} value={value ?? 3} />
              </span>
              {t(`${question}.label`)}
            </button>
          );
        })}
      </div>

      <fieldset key={active} className="checkin-in flex flex-col gap-2">
        <legend className="sr-only">{t(`${active}.label`)}</legend>
        <div className="flex justify-between gap-1">
          {SCALE.map((value) => {
            const checked = values[active] === value;
            return (
              <label
                key={value}
                className={`flex size-14 cursor-pointer items-center justify-center rounded-2xl border-2 transition has-[:focus-visible]:outline-2 ${
                  checked
                    ? "border-primary bg-primary text-on-primary"
                    : "border-transparent bg-surface-muted text-text-muted hover:text-text"
                } ${checked && popped === `${active}-${value}` ? "pop" : ""}`}
              >
                <input
                  type="radio"
                  name={`checkin-${active}`}
                  checked={checked}
                  onChange={() => choose(active, value)}
                  aria-label={t("scaleValue", { question: t(`${active}.label`), value })}
                  className="sr-only"
                />
                <span aria-hidden className="size-9">
                  <Glyph question={active} value={value} />
                </span>
              </label>
            );
          })}
        </div>
        <p className="flex justify-between text-xs text-text-muted" aria-hidden>
          <span>{t(`${active}.low`)}</span>
          <span>{t(`${active}.high`)}</span>
        </p>
        <p className="sr-only">{t("scaleHint", { low: t(`${active}.low`), high: t(`${active}.high`) })}</p>
      </fieldset>
      {done && (
        <p className="checkin-in text-sm font-semibold text-primary" aria-live="polite">
          {t("thanks")}
        </p>
      )}
    </div>
  );
}

/** Dessin d'une réponse de 1 à 5 : barres de faim, pile d'énergie ou visage d'humeur. */
function Glyph({ question, value }: { question: Question; value: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {question === "hunger" &&
        SCALE.map((step) => (
          <rect
            key={step}
            x={3 + (step - 1) * 5.6}
            y={26 - step * 4}
            width={3.6}
            height={step * 4}
            rx={1.4}
            fill={step <= value ? "currentColor" : "none"}
            strokeWidth={1.6}
          />
        ))}
      {question === "energy" && (
        <>
          <rect x={3} y={9} width={23} height={14} rx={3.5} />
          <path d="M29 14v4" />
          <rect x={6} y={12} width={(17 * value) / 5} height={8} rx={1.5} fill="currentColor" stroke="none" />
        </>
      )}
      {question === "mood" && (
        <>
          <circle cx={16} cy={16} r={12.5} />
          <circle cx={11.5} cy={13} r={1.4} fill="currentColor" stroke="none" />
          <circle cx={20.5} cy={13} r={1.4} fill="currentColor" stroke="none" />
          <path d={`M10.5 20.5 Q16 ${20.5 + (value - 3) * 3} 21.5 20.5`} />
        </>
      )}
    </svg>
  );
}
