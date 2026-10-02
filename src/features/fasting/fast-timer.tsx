"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { fastProgress } from "@/domain/fasting";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { endFastAction, startFastAction } from "./actions";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function hoursMinutes(minutes: number): { h: number; m: number } {
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** Minuteur visuel du jeûne : anneau de progression, temps écoulé et restant, mis à jour chaque seconde. */
export function FastTimer({
  current,
  next,
  serverNow,
}: {
  current: { startedAt: string; targetMinutes: number } | null;
  next: { start: string; hours: number } | null;
  /** Heure du rendu serveur : le premier affichage est identique des deux côtés. */
  serverNow: string;
}) {
  const t = useTranslations("fasting.timer");
  const format = useFormatter();
  const errorText = useErrorText();
  const [now, setNow] = useState(() => new Date(serverNow));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [current]);

  const act = (action: () => Promise<{ error?: string } | null>) =>
    startTransition(async () => {
      const result = await action();
      setError(result?.error ?? null);
      setNow(new Date());
    });

  if (!current) {
    return (
      <div className="flex flex-col gap-3">
        <p>
          {next
            ? t("next", {
                date: format.dateTime(new Date(next.start), { weekday: "long", hour: "2-digit", minute: "2-digit" }),
                hours: next.hours,
              })
            : t("idle")}
        </p>
        {error && <Alert>{errorText(error)}</Alert>}
        <Button type="button" onClick={() => act(startFastAction)} disabled={pending}>
          {t("start")}
        </Button>
      </div>
    );
  }

  const startedAt = new Date(current.startedAt);
  const progress = fastProgress(startedAt, null, current.targetMinutes, now);
  const elapsed = hoursMinutes(progress.elapsedMinutes);
  const remaining = hoursMinutes(progress.remainingMinutes);
  const end = new Date(startedAt.getTime() + current.targetMinutes * 60_000);
  const percent = Math.round(progress.ratio * 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={t("elapsed", elapsed)}
        className="relative size-56"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-surface-muted" />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress.ratio)}
            className="stroke-primary transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-semibold tabular-nums">
            {t("clock", { h: elapsed.h, mm: String(elapsed.m).padStart(2, "0") })}
          </span>
          <span className="text-sm text-text-muted">{t("of", { hours: Math.round(current.targetMinutes / 60) })}</span>
        </div>
      </div>
      <p className="text-center" aria-live="polite">
        {progress.reached ? t("reached") : t("remaining", remaining)}
      </p>
      <p className="text-sm text-text-muted">
        {t("window", {
          start: format.dateTime(startedAt, { hour: "2-digit", minute: "2-digit" }),
          end: format.dateTime(end, { weekday: "short", hour: "2-digit", minute: "2-digit" }),
        })}
      </p>
      {error && <Alert>{errorText(error)}</Alert>}
      <Button type="button" variant="secondary" onClick={() => act(endFastAction)} disabled={pending}>
        {t("end")}
      </Button>
    </div>
  );
}
