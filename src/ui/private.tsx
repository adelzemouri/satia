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

/** Bloc flouté tant que le poids est masqué ; un toucher l'affiche. */
export function PrivateBlock({ children, className = "" }: { children: ReactNode; className?: string }) {
  const shown = useWeightShown();
  const t = useTranslations("privacy");
  if (shown) return <div className={className}>{children}</div>;
  return (
    <div className="relative min-h-11">
      <div inert className={`pointer-events-none blur-md select-none ${className}`}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setWeightShown(true)}
        className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl font-semibold text-primary"
      >
        <Icon name="eye" />
        {t("show")}
      </button>
    </div>
  );
}

/** Bouton qui affiche ou masque le poids partout dans l'app. */
export function PrivacyToggle() {
  const shown = useWeightShown();
  const t = useTranslations("privacy");
  return (
    <button
      type="button"
      onClick={() => setWeightShown(!shown)}
      aria-pressed={!shown}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary"
    >
      <Icon name={shown ? "eyeOff" : "eye"} size={18} />
      {shown ? t("hide") : t("show")}
    </button>
  );
}
