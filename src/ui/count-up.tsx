"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion, swapRemembered, tween } from "./motion";

const DURATION_MS = 700;

/**
 * Nombre qui défile depuis la dernière valeur affichée (après un ajout, les calories restantes
 * descendent jusqu'au nouveau total). Le rendu serveur montre directement la valeur finale ; seul
 * le texte change pendant l'animation, sans nouveau rendu React.
 */
export function CountUp({ value, memoryKey }: { value: number; memoryKey: string }) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const from = swapRemembered(memoryKey, value);
    if (!element || from === null || from === value || prefersReducedMotion()) return;
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
  }, [locale, memoryKey, value]);

  return <span ref={ref}>{new Intl.NumberFormat(locale).format(value)}</span>;
}
