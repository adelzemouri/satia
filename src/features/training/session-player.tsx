"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import type { Feeling, Focus, LoggedSet } from "@/domain/training/types";
import { FEELINGS } from "@/domain/training/types";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { OptionList } from "@/ui/option-list";

import { logSessionAction, setExerciseExcludedAction } from "./actions";

export type PlayerStep = {
  phase: "warmup" | "main" | "cooldown";
  exerciseId: string;
  name: string;
  steps: string[];
  mistakes: string[];
  easier: string;
  harder: string | null;
  /** Une charge peut être saisie (exercice avec matériel). */
  usesLoad: boolean;
  sets: number;
  reps: number | null;
  seconds: number | null;
  restSeconds: number;
};

export type PlayerSession = {
  kind: "program" | "replacement" | "express" | "on_demand";
  focus: Focus;
  title: string;
  minutes: number;
  tip: string | null;
  steps: PlayerStep[];
};

const inputClass = "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base";

/** Signal de fin de minuteur : bip court (Web Audio) et vibration si le téléphone le permet. */
function signal() {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.25);
      oscillator.onended = () => void context.close();
    }
  } catch {
    // Le son est un bonus : sans lui, la séance continue.
  }
  navigator.vibrate?.([200, 100, 200]);
}

/** Écran maintenu allumé pendant la séance (Wake Lock API), repris au retour sur l'onglet. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Refusé (batterie faible, onglet masqué) : la séance reste utilisable.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** Compte à rebours en secondes, calé sur l'horloge (reste juste même si l'onglet ralentit). */
function useCountdown(onDone: () => void) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setEndsAt(null);
        signal();
        done.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return {
    left,
    running: endsAt !== null,
    paused: pausedLeft !== null,
    start: (seconds: number) => {
      setPausedLeft(null);
      setLeft(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    },
    pause: () => {
      if (endsAt === null) return;
      setPausedLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setEndsAt(null);
    },
    resume: () => {
      if (pausedLeft === null) return;
      setEndsAt(Date.now() + pausedLeft * 1000);
      setPausedLeft(null);
    },
    stop: () => {
      setEndsAt(null);
      setPausedLeft(null);
      setLeft(null);
    },
  };
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Mode séance guidé : échauffement, exercices et retour au calme, avec minuteurs de travail
 * et de repos, compteur de séries, saisie des répétitions et charges, puis ressenti.
 */
export function SessionPlayer({ session }: { session: PlayerSession }) {
  const t = useTranslations("training");
  const errorText = useErrorText();
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [resting, setResting] = useState(false);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [log, setLog] = useState<Record<string, LoggedSet[]>>({});
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const workStarted = useRef<number | null>(null);

  const step = session.steps[index];
  const total = session.steps.length;
  useWakeLock(startedAt !== null && finishedAt === null);

  const goTo = useCallback(
    (next: number) => {
      setResting(false);
      setSetNumber(1);
      workStarted.current = null;
      if (next >= total) setFinishedAt(Date.now());
      else {
        setIndex(next);
        setReps(String(session.steps[next]?.reps ?? ""));
        setWeight("");
      }
    },
    [session.steps, total],
  );

  const rest = useCountdown(() => setResting(false));
  const work = useCountdown(() => completeSet());

  /** Une série est faite : on la note, puis repos ou exercice suivant. */
  function completeSet() {
    if (!step) return;
    const elapsed = workStarted.current ? Math.round((Date.now() - workStarted.current) / 1000) : null;
    const entry: LoggedSet = {
      reps: step.reps !== null ? Math.max(0, Number(reps) || 0) : null,
      weightKg: step.usesLoad && weight ? Math.max(0, Number(weight.replace(",", ".")) || 0) || null : null,
      seconds: step.seconds !== null ? Math.min(step.seconds, elapsed ?? step.seconds) : null,
    };
    setLog((current) => ({ ...current, [step.exerciseId]: [...(current[step.exerciseId] ?? []), entry] }));
    work.stop();
    workStarted.current = null;
    if (setNumber < step.sets) {
      setSetNumber(setNumber + 1);
      if (step.restSeconds > 0) {
        setResting(true);
        rest.start(step.restSeconds);
      }
    } else {
      goTo(index + 1);
    }
  }

  const startWork = () => {
    if (!step?.seconds) return;
    workStarted.current = Date.now();
    work.start(step.seconds);
  };

  const reportPain = () =>
    startTransition(async () => {
      if (!step) return;
      work.stop();
      rest.stop();
      const result = await setExerciseExcludedAction(step.exerciseId, true);
      setNotice(result?.error ? errorText(result.error) : t("session.painDone"));
      goTo(index + 1);
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const minutes = Math.max(1, Math.round(((finishedAt ?? Date.now()) - (startedAt ?? Date.now())) / 60000));
      const result = await logSessionAction({
        kind: session.kind,
        focus: session.focus,
        title: session.title,
        durationMin: Math.min(240, minutes),
        feeling,
        items: Object.entries(log).map(([exerciseId, sets]) => ({ exerciseId, sets })),
      });
      if (result?.error) setError(result.error);
      else router.push("/training/history");
    });

  if (startedAt === null) {
    return (
      <div className="flex flex-col gap-4">
        {session.tip && <p className="rounded-2xl bg-surface-muted px-4 py-3">{session.tip}</p>}
        <h2 className="text-xl font-semibold">{t("session.overview")}</h2>
        {(["warmup", "main", "cooldown"] as const).map((phase) => (
          <section key={phase} aria-labelledby={`overview-${phase}`} className="flex flex-col gap-1">
            <h3 id={`overview-${phase}`} className="font-semibold text-text-muted">
              {t(`session.${phase}`)}
            </h3>
            <ul className="flex flex-col">
              {session.steps
                .filter((item) => item.phase === phase)
                .map((item) => (
                  <li key={item.exerciseId} className="py-1">
                    {item.name}
                    <span className="text-text-muted">
                      {" · "}
                      {item.sets > 1 && `${item.sets} × `}
                      {item.reps !== null
                        ? t("session.targetReps", { count: item.reps })
                        : t("session.targetSeconds", { count: item.seconds ?? 0 })}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        <Button
          onClick={() => {
            setStartedAt(Date.now());
            setReps(String(session.steps[0]?.reps ?? ""));
          }}
        >
          {t("session.start")}
        </Button>
      </div>
    );
  }

  if (finishedAt !== null || !step) {
    const minutes = Math.max(1, Math.round(((finishedAt ?? Date.now()) - startedAt) / 60000));
    return (
      <div className="flex flex-col gap-4">
        {notice && <Alert tone="success">{notice}</Alert>}
        <h2 className="font-display text-2xl font-extrabold tracking-tight">{t("session.finishTitle")}</h2>
        <p>{t("session.elapsed", { minutes })}</p>
        <OptionList<Feeling>
          legend={t("session.feeling")}
          name="feeling"
          value={feeling}
          onChange={setFeeling}
          options={FEELINGS.map((value) => ({ value, label: t(`session.feelings.${value}`) }))}
        />
        <p className="text-sm text-text-muted">{t("session.feelingHint")}</p>
        {error && <Alert>{errorText(error)}</Alert>}
        <Button onClick={save} disabled={pending}>
          {t("session.save")}
        </Button>
      </div>
    );
  }

  const target =
    step.reps !== null
      ? t("session.targetReps", { count: step.reps })
      : t("session.targetSeconds", { count: step.seconds ?? 0 });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted" aria-live="polite">
        {t("session.step", { current: index + 1, total })} · {t(`session.${step.phase}`)}
      </p>
      <progress className="h-2 w-full accent-[var(--color-primary)]" max={total} value={index} aria-hidden />
      {notice && <Alert tone="success">{notice}</Alert>}
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{step.name}</h2>
      <p className="text-lg">
        {step.sets > 1 && (
          <span className="font-semibold">{t("session.set", { current: setNumber, total: step.sets })} · </span>
        )}
        {target}
      </p>

      {resting ? (
        <div
          role="timer"
          aria-label={t("session.rest")}
          className="flex flex-col items-center gap-3 rounded-2xl bg-primary-soft p-6"
        >
          <span className="font-semibold">{t("session.rest")}</span>
          <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums">
            {formatClock(rest.left ?? 0)}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              rest.stop();
              setResting(false);
            }}
          >
            {t("session.skipRest")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {step.seconds !== null && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-muted p-6">
              <span role="timer" className="font-display text-5xl font-extrabold tracking-tight tabular-nums">
                {formatClock(work.left ?? step.seconds)}
              </span>
              {work.running ? (
                <Button variant="secondary" onClick={work.pause}>
                  {t("session.pause")}
                </Button>
              ) : work.paused ? (
                <Button variant="secondary" onClick={work.resume}>
                  {t("session.resume")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={startWork}>
                  <Icon name="timer" />
                  {t("session.timer")}
                </Button>
              )}
            </div>
          )}
          {step.reps !== null && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold">{t("session.repsDone")}</span>
                <input
                  inputMode="numeric"
                  value={reps}
                  onChange={(event) => setReps(event.target.value.replace(/\D/g, ""))}
                  className={inputClass}
                />
              </label>
              {step.usesLoad && (
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">{t("session.weight")}</span>
                  <input
                    inputMode="decimal"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value.replace(/[^\d.,]/g, ""))}
                    className={inputClass}
                  />
                </label>
              )}
            </div>
          )}
          <Button onClick={completeSet}>{t("session.setDone")}</Button>
        </div>
      )}

      <details className="rounded-2xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-semibold">{t("session.how")}</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
          {step.steps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h3 className="mt-3 font-semibold">{t("session.watch")}</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {step.mistakes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <p className="text-sm">{t("session.easier", { text: step.easier })}</p>
      {step.harder && <p className="text-sm text-text-muted">{t("session.harder", { text: step.harder })}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => goTo(index + 1)} disabled={pending}>
          {t("session.skip")}
        </Button>
        <Button variant="ghost" onClick={reportPain} disabled={pending}>
          {t("session.pain")}
        </Button>
      </div>
      <p className="text-xs text-text-muted">{t("session.awake")}</p>
    </div>
  );
}
