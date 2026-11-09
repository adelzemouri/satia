"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { COACH_NAME } from "@/config/app";
import { type Highlight, sessionHighlights } from "@/domain/training/pepin";
import type { PersonalRecord } from "@/domain/training/program";
import type { Feeling, Focus, LoggedSet, Muscle } from "@/domain/training/types";
import { FEELINGS } from "@/domain/training/types";
import { useErrorText } from "@/features/auth/use-error-text";
import { CoachAvatar } from "@/features/coach/coach-avatar";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";

import { logSessionAction, setExerciseExcludedAction } from "./actions";
import { ExerciseAnimation } from "./exercise-animation";
import { ExerciseArt } from "./exercise-art";
import { PepinSays } from "./pepin-says";

export type PlayerStep = {
  phase: "warmup" | "main" | "cooldown";
  exerciseId: string;
  name: string;
  muscle: Muscle;
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
  /** Aucune séance enregistrée jusqu'ici : fin de séance « première fois ». */
  firstSession: boolean;
  /** Semaines actives d'affilée une fois cette séance enregistrée. */
  weeksIfDone: number;
  firstName: string;
  /** Repères déjà atteints sur les exercices de la séance. */
  records: PersonalRecord[];
};

const feelingClass =
  "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface px-1 text-center text-sm font-bold has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]";

/** Quelques pépins et feuilles posés au-dessus de Pépin en fin de séance (positions fixes). */
const FINISH_CONFETTI = Array.from({ length: 14 }, (_, index) => ({
  left: (index * 41 + 7) % 100,
  top: (index * 29) % 70,
  turn: (index * 67) % 180,
  leaf: index % 3 === 1,
})).filter((piece) => piece.left < 30 || piece.left > 70);

/** Jauge d'effort : trois barres qui montent ; la plus haute passe en rouge pomme. */
function EffortBars({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="flex h-7 items-end gap-1">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`w-2 rounded-full ${bar <= level ? (level === 3 ? "bg-pomme" : "bg-primary") : "bg-border"}`}
          style={{ height: `${bar * 33}%` }}
        />
      ))}
    </span>
  );
}

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
  const [panel, setPanel] = useState<"easier" | "how" | "pain" | null>(null);
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const workStarted = useRef<number | null>(null);

  const step = session.steps[index];
  const total = session.steps.length;
  const mainIds = new Set(session.steps.filter((item) => item.phase === "main").map((item) => item.exerciseId));
  const mainCount = mainIds.size;
  useWakeLock(startedAt !== null && finishedAt === null);

  const goTo = useCallback(
    (next: number) => {
      setResting(false);
      setSetNumber(1);
      setPanel(null);
      workStarted.current = null;
      if (next >= total) {
        setFinishedAt(Date.now());
        haptic([20, 60, 30]);
      } else {
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

  const says = t("pepin.says", { name: COACH_NAME });
  const quit = (
    <Link href="/training" className="font-semibold text-primary underline-offset-4 hover:underline">
      {t("session.quitShort")}
    </Link>
  );

  if (startedAt === null) {
    return (
      <div className="flex flex-col gap-5 lg:mx-auto lg:w-full lg:max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight">{session.title}</h1>
            <p className="text-text-muted">
              {t("minutes", { count: session.minutes })} · {t("exercises", { count: mainCount })}
            </p>
          </div>
          <span className="pt-2">{quit}</span>
        </div>
        <PepinSays says={says}>{session.tip ?? t("pepin.overview", { count: mainCount })}</PepinSays>
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4">
          <h2 className="text-lg font-bold">{t("session.overview")}</h2>
          {(["warmup", "main", "cooldown"] as const).map((phase) => (
            <section key={phase} aria-labelledby={`overview-${phase}`} className="flex flex-col gap-2">
              <h3 id={`overview-${phase}`} className="text-sm font-semibold text-text-muted">
                {t(`session.${phase}`)}
              </h3>
              <ul className="flex flex-col gap-2">
                {session.steps
                  .filter((item) => item.phase === phase)
                  .map((item) => (
                    <li key={item.exerciseId} className="flex items-center gap-3">
                      <ExerciseArt
                        exerciseId={item.exerciseId}
                        muscle={item.muscle}
                        size={44}
                        className={`rounded-xl ${phase === "main" ? "" : "bg-surface-muted"}`}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-sm text-text-muted">
                          {item.sets > 1 && `${item.sets} × `}
                          {item.reps !== null
                            ? t("session.targetReps", { count: item.reps })
                            : t("session.targetSeconds", { count: item.seconds ?? 0 })}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
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
    const done = Object.entries(log)
      .filter(([exerciseId, sets]) => sets.length > 0 && mainIds.has(exerciseId))
      .map(([exerciseId, sets]) => ({ exerciseId, sets }));
    const highlights = sessionHighlights(done, session.records);
    const firstMarks = highlights.every((item) => item.previous === null);
    const mark = (unit: Highlight["unit"], value: number) =>
      unit === "kg"
        ? t("session.markKg", { value: format.number(value) })
        : unit === "reps"
          ? t("session.markReps", { value })
          : t("session.markSeconds", { value });
    return (
      <div className="relative flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-lg">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-2 h-40 overflow-hidden">
          {FINISH_CONFETTI.map((piece, index) => (
            <span
              key={index}
              className={`training-confetti ${piece.leaf ? "training-confetti-leaf" : ""}`}
              style={{
                left: `${piece.left}%`,
                top: `${piece.top}%`,
                rotate: `${piece.turn}deg`,
                animationDelay: `${index * 40}ms`,
              }}
            />
          ))}
        </div>
        <div className="relative flex flex-col items-center gap-2 pt-2 text-center">
          <CoachAvatar size={88} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance">
            {session.firstSession ? t("session.finishFirst") : t("session.finishTitle")}
          </h1>
          <p className="text-text-muted">
            {t(session.firstSession ? "session.finishFirstBody" : "session.finishBody", { name: session.firstName })}
          </p>
        </div>
        {notice && <Alert tone="success">{notice}</Alert>}
        <dl className="grid grid-cols-3 rounded-[var(--radius-card)] bg-surface py-4 text-center">
          {(
            [
              [minutes, t("session.statMinutes", { count: minutes })],
              [done.length, t("session.statExercises", { count: done.length })],
              [session.weeksIfDone, t("session.statWeeks", { count: session.weeksIfDone })],
            ] as const
          ).map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {highlights.length > 0 && (
          <section
            aria-labelledby="marks-title"
            className="flex flex-col rounded-[var(--radius-card)] bg-surface px-4 pt-4 pb-1"
          >
            <h2 id="marks-title" className="font-bold">
              {firstMarks ? t("session.firstMarks") : t("session.newMarks")}
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              {highlights.map((item) => {
                const exercise = session.steps.find((candidate) => candidate.exerciseId === item.exerciseId);
                return (
                  <li key={item.exerciseId} className="flex items-center gap-3 py-2.5">
                    {exercise && (
                      <ExerciseArt
                        exerciseId={item.exerciseId}
                        muscle={exercise.muscle}
                        size={44}
                        className="rounded-xl"
                      />
                    )}
                    <span className="min-w-0 flex-1 font-semibold">{exercise?.name}</span>
                    <span className="flex flex-col items-end">
                      <span className="font-display text-xl font-extrabold tabular-nums">
                        {mark(item.unit, item.value)}
                      </span>
                      {item.previous !== null && (
                        <span className="text-xs font-semibold text-primary">
                          {t("session.markBefore", { value: mark(item.unit, item.previous) })}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">{t("session.feeling")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {FEELINGS.map((value, level) => (
              <label key={value} className={feelingClass}>
                <input
                  type="radio"
                  name="feeling"
                  value={value}
                  checked={feeling === value}
                  onChange={() => setFeeling(value)}
                  className="sr-only"
                />
                <EffortBars level={level + 1} />
                {t(`session.feelings.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {feeling ? (
          <PepinSays says={says} size={32} soft live className="text-sm">
            {t(`pepin.feelings.${feeling}`)}
          </PepinSays>
        ) : (
          <p className="text-sm text-text-muted" aria-live="polite">
            {t("session.feelingHint")}
          </p>
        )}
        {error && <Alert>{errorText(error)}</Alert>}
        <Button onClick={save} disabled={pending}>
          {t("session.save")}
        </Button>
      </div>
    );
  }

  const phaseSteps = session.steps.filter((item) => item.phase === step.phase);
  const nextStep = setNumber < step.sets ? null : session.steps[index + 1];
  const cue = step.steps[1] ?? step.steps[0];
  const tools = [
    ["easier", "down", t("session.easierShort")],
    ["how", "book", t("session.howShort")],
    ["pain", "alert", t("session.painShort")],
  ] as const;

  return (
    <div className="flex flex-col gap-4 lg:rounded-[var(--radius-card)] lg:bg-surface lg:p-7">
      <h1 className="sr-only">{session.title}</h1>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-muted" aria-live="polite">
          {t("session.phaseCount", {
            phase: t(`session.${step.phase}`),
            current: phaseSteps.indexOf(step) + 1,
            total: phaseSteps.length,
          })}
          <span className="sr-only"> · {t("session.step", { current: index + 1, total })}</span>
        </p>
        {quit}
      </div>
      <ol aria-hidden="true" className="flex gap-1">
        {session.steps.map((item, position) => (
          <li
            key={`${item.exerciseId}-${position}`}
            className={`h-1.5 flex-1 rounded-full ${position < index ? "bg-primary" : position === index ? "bg-pomme" : "bg-surface-muted lg:bg-bg"}`}
          />
        ))}
      </ol>
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
        <div className="flex h-64 justify-center rounded-2xl bg-primary-soft lg:h-[26rem]">
          <ExerciseAnimation
            key={step.exerciseId}
            exerciseId={step.exerciseId}
            muscle={step.muscle}
            name={step.name}
            className="aspect-square h-full"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-center lg:text-left">
            <h2 className="font-display text-3xl leading-tight font-extrabold tracking-tight">{step.name}</h2>
            {step.sets > 1 && (
              <p className="text-text-muted">{t("session.set", { current: setNumber, total: step.sets })}</p>
            )}
          </div>

          {resting ? (
            <div
              role="timer"
              aria-label={t("session.rest")}
              className="flex flex-col items-center gap-3 lg:items-start"
            >
              <span className="text-sm font-semibold text-text-muted">{t("session.rest")}</span>
              <span className="font-display text-6xl font-extrabold tracking-tight tabular-nums">
                {formatClock(rest.left ?? 0)}
              </span>
              <Button
                variant="secondary"
                className="self-stretch"
                onClick={() => {
                  rest.stop();
                  setResting(false);
                }}
              >
                {t("session.skipRest")}
              </Button>
            </div>
          ) : (
            <>
              {step.seconds !== null && (
                <div className="flex flex-col items-center gap-3 lg:items-start">
                  <span role="timer" className="font-display text-6xl font-extrabold tracking-tight tabular-nums">
                    {formatClock(work.left ?? step.seconds)}
                  </span>
                  {work.running ? (
                    <Button variant="secondary" onClick={work.pause}>
                      <Icon name="pause" />
                      {t("session.pause")}
                    </Button>
                  ) : work.paused ? (
                    <Button variant="secondary" onClick={work.resume}>
                      <Icon name="play" />
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
                <div className="flex flex-col items-center gap-3 lg:items-start">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={t("session.repsLess")}
                      onClick={() => setReps(String(Math.max(0, (Number(reps) || 0) - 1)))}
                      className="flex size-12 items-center justify-center rounded-full bg-surface-muted"
                    >
                      <Icon name="minus" />
                    </button>
                    <label className="flex flex-col items-center">
                      <input
                        inputMode="numeric"
                        value={reps}
                        onChange={(event) => setReps(event.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="w-24 rounded-2xl bg-transparent text-center font-display text-6xl font-extrabold tabular-nums"
                      />
                      <span className="text-sm text-text-muted">{t("session.repsDone")}</span>
                    </label>
                    <button
                      type="button"
                      aria-label={t("session.repsMore")}
                      onClick={() => setReps(String(Math.min(999, (Number(reps) || 0) + 1)))}
                      className="flex size-12 items-center justify-center rounded-full bg-surface-muted"
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  {step.usesLoad && (
                    <label className="flex w-full flex-col gap-1.5">
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
            </>
          )}

          {step.sets > 1 && (
            <ol aria-hidden="true" className="flex justify-center gap-1.5 lg:justify-start">
              {Array.from({ length: step.sets }, (_, set) => (
                <li
                  key={set}
                  className={`h-2 w-8 rounded-full ${set < setNumber - 1 ? "bg-primary" : "bg-surface-muted lg:bg-bg"}`}
                />
              ))}
            </ol>
          )}

          <PepinSays says={says} size={32} soft live className="text-sm">
            {resting
              ? nextStep
                ? t("pepin.restExercise", { name: nextStep.name })
                : t("pepin.restSet", { current: setNumber })
              : cue}
          </PepinSays>

          {!resting && <Button onClick={completeSet}>{t("session.setDone")}</Button>}

          <div className="grid grid-cols-3 gap-2">
            {tools.map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                aria-expanded={panel === key}
                aria-controls="session-panel"
                onClick={() => setPanel(panel === key ? null : key)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-sm font-semibold ${
                  panel === key ? "bg-primary-soft" : "bg-surface lg:bg-bg"
                }`}
              >
                <span className="text-primary">
                  <Icon name={icon} size={20} />
                </span>
                {label}
              </button>
            ))}
          </div>
          {panel && (
            <div id="session-panel" className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
              {panel === "easier" && (
                <>
                  <p>{step.easier}</p>
                  {step.harder && (
                    <p className="text-sm text-text-muted">{t("session.harderShort", { text: step.harder })}</p>
                  )}
                </>
              )}
              {panel === "how" && (
                <>
                  <ol className="flex list-decimal flex-col gap-1 pl-5">
                    {step.steps.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                  <h3 className="mt-1 font-semibold">{t("session.watch")}</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    {step.mistakes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {panel === "pain" && (
                <>
                  <p className="font-semibold">{t("session.painTitle")}</p>
                  <p className="text-sm text-text-muted">{t("session.painHint")}</p>
                  <Button variant="secondary" onClick={reportPain} disabled={pending}>
                    {t("session.painConfirm")}
                  </Button>
                </>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={() => goTo(index + 1)} disabled={pending} className="self-center">
            {t("session.skip")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-text-muted">{t("session.awake")}</p>
    </div>
  );
}
