"use client";

import { type KeyboardEvent, useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "@/ui/motion";

/**
 * Règle à faire glisser du doigt, pour choisir une valeur en grand (poids visé, eau, calories).
 * Le défilement natif garde l'élan du téléphone ; la règle se cale ensuite sur la graduation la
 * plus proche. Au clavier : flèches pour un cran, Page haut/bas pour un grand cran, Début et Fin.
 */
export function Ruler({
  min,
  max,
  step,
  value,
  onChange,
  label,
  valueText,
  majorEvery = 10,
  tickPx = 10,
  formatMajor = (major) => String(major),
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  valueText: string;
  /** Une grande graduation, avec son nombre, tous les `majorEvery` crans. */
  majorEvery?: number;
  tickPx?: number;
  formatMajor?: (value: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const count = Math.round((max - min) / step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const clampIndex = (index: number) => Math.min(count, Math.max(0, index));
  const valueAt = (index: number) => Number((min + clampIndex(index) * step).toFixed(decimals));
  const indexOf = (current: number) => clampIndex(Math.round((current - min) / step));

  // Position de départ seulement : ensuite, c'est le doigt (ou le clavier) qui mène.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = indexOf(value) * tickPx;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- au montage uniquement
  }, []);
  useLayoutEffect(() => () => clearTimeout(settle.current), []);

  const onScroll = () => {
    const element = ref.current;
    if (!element) return;
    const index = clampIndex(Math.round(element.scrollLeft / tickPx));
    const next = valueAt(index);
    if (next !== value) onChange(next);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (Math.abs(element.scrollLeft - index * tickPx) > 1)
        element.scrollTo({ left: index * tickPx, behavior: "smooth" });
    }, 140);
  };

  const moveTo = (index: number) => {
    const target = clampIndex(index);
    ref.current?.scrollTo({ left: target * tickPx, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    onChange(valueAt(target));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const current = indexOf(value);
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      PageUp: current + majorEvery,
      PageDown: current - majorEvery,
      Home: 0,
      End: count,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    moveTo(moves[event.key]!);
  };

  // Les grandes graduations tombent sur des valeurs rondes, même si la règle commence ailleurs.
  const offset = (majorEvery - (Math.round(min / step) % majorEvery)) % majorEvery;
  const majors: number[] = [];
  for (let at = offset; at <= count; at += majorEvery) majors.push(at);

  return (
    <div className="relative w-full">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="touch-pan-x [scrollbar-width:none] overflow-x-auto overscroll-x-contain rounded-2xl focus-visible:outline-3 [&::-webkit-scrollbar]:hidden"
      >
        <div className="box-content h-24" style={{ width: count * tickPx, paddingInline: "50%" }}>
          <div
            className="relative h-full bg-no-repeat"
            style={{
              width: count * tickPx,
              backgroundImage: `repeating-linear-gradient(to right, var(--color-border) 0 2px, transparent 2px ${tickPx}px)`,
              backgroundSize: `${count * tickPx + 2}px 20px`,
              backgroundPosition: "-1px 36px",
            }}
          >
            {majors.map((at) => (
              <span
                key={at}
                aria-hidden="true"
                className="absolute top-6 flex -translate-x-1/2 flex-col items-center gap-2 text-sm font-semibold text-text-muted tabular-nums"
                style={{ left: at * tickPx }}
              >
                <span className="h-9 w-0.5 rounded-full bg-text-muted/60" />
                {formatMajor(valueAt(at))}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Repère central : c'est la valeur sous ce trait qui compte. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 left-1/2 h-14 w-1 -translate-x-1/2 rounded-full bg-primary"
      />
    </div>
  );
}
