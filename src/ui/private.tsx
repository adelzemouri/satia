"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useSyncExternalStore } from "react";

import { Icon } from "./icon";

/**
 * Poids masqué par défaut : flouté jusqu'à ce qu'on le demande, puis visible tant que l'app
 * reste ouverte (sessionStorage), pour ne pas l'exposer à qui regarde l'écran.
 */
const KEY = "pommelia:weight-shown";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWeightShown(shown: boolean): void {
  try {
    if (shown) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : le poids redevient flouté au prochain affichage.
  }
  for (const listener of listeners) listener();
}

export function useWeightShown(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-primary shadow-sm";

/**
 * Bloc flouté tant que le poids est masqué : la pastille « Afficher » le dévoile, la pastille
 * « Masquer » au même endroit le refloute (partout dans l'app).
 */
export function PrivateBlock({ children, className = "" }: { children: ReactNode; className?: string }) {
  const shown = useWeightShown();
  const t = useTranslations("privacy");
  if (shown) {
    return (
      <div className="flex flex-col gap-2">
        <div className={className}>{children}</div>
        <button type="button" onClick={() => setWeightShown(false)} className={`${PILL} self-end`}>
          <Icon name="eyeOff" size={18} />
          {t("hide")}
        </button>
      </div>
    );
  }
  return (
    <div className="relative min-h-16">
      <div inert className={`pointer-events-none blur-md select-none ${className}`}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setWeightShown(true)}
        className="group absolute inset-0 flex items-center justify-center rounded-2xl"
      >
        <span className={`${PILL} group-hover:bg-surface-muted`}>
          <Icon name="eye" size={18} />
          {t("show")}
        </span>
      </button>
    </div>
  );
}

/**
 * Valeur de poids en ligne (une ligne de réglage, par exemple) : remplacée par des points tant
 * que le poids est masqué. On la dévoile depuis un bloc flouté, comme ailleurs dans l'app.
 */
export function PrivateText({ children }: { children: ReactNode }) {
  const shown = useWeightShown();
  const t = useTranslations("privacy");
  if (shown) return <>{children}</>;
  return (
    <>
      <span aria-hidden="true">•••</span>
      <span className="sr-only">{t("hidden")}</span>
    </>
  );
}
