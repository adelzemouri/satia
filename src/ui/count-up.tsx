"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, useRef } from "react";

import { fillsDone, lastShown, prefersReducedMotion, rememberShown, tween } from "./motion";

/** Défilement à l'ouverture de l'app, et après un changement (plus court). */
const FIRST_MS = 600;
const CHANGE_MS = 500;

/**
 * Nombre qui défile : depuis zéro à l'ouverture de l'app, puis depuis la dernière valeur montrée
 * (`memoryKey`), même après être passé par une autre page : seul l'écart défile. Le rendu serveur
 * montre directement la valeur finale ; seul le texte change pendant l'animation, sans nouveau
 * rendu React.
 */
export function CountUp({ value, memoryKey }: { value: number; memoryKey: string }) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const first = shown.current === null;
    const from = shown.current ?? lastShown(memoryKey) ?? (fillsDone() ? value : 0);
    shown.current = value;
    rememberShown(memoryKey, value);
    if (!element || from === value || prefersReducedMotion()) return;
    const duration = first && from === 0 ? FIRST_MS : CHANGE_MS;
    const format = new Intl.NumberFormat(locale);
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = (now - start) / duration;
      element.textContent = format.format(tween(from, value, progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    element.textContent = format.format(from);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = format.format(value);
    };
  }, [locale, memoryKey, value]);

  return <span ref={ref}>{new Intl.NumberFormat(locale).format(value)}</span>;
}
