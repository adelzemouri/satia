"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion, tween } from "./motion";

const DURATION_MS = 700;

/**
 * Nombre qui défile : depuis zéro à chaque arrivée sur la page, puis depuis la valeur précédente
 * quand elle change sur place (après un ajout). Le rendu serveur montre directement la valeur
 * finale ; seul le texte change pendant l'animation, sans nouveau rendu React.
 */
export function CountUp({ value }: { value: number }) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useLayoutEffect(() => {
    const element = ref.current;
    const from = shown.current;
    shown.current = value;
    if (!element || from === value || prefersReducedMotion()) return;
    const format = new Intl.NumberFormat(locale);
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = (now - start) / DURATION_MS;
      element.textContent = format.format(tween(from, value, progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    element.textContent = format.format(from);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = format.format(value);
    };
  }, [locale, value]);

  return <span ref={ref}>{new Intl.NumberFormat(locale).format(value)}</span>;
}
