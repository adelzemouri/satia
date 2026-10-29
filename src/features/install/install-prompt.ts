"use client";

import { useSyncExternalStore } from "react";

/** Événement de Chrome, Edge et Samsung Internet (absent de Safari et Firefox). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

// Le navigateur l'envoie tôt, une seule fois par page : on le garde dès le chargement du module
// pour le bouton « Installer », qui le rejoue plus tard.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** L'installation en un bouton quand le navigateur la permet ; `null` sinon. */
export function useInstallPrompt(): (() => Promise<boolean>) | null {
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
  if (!event) return null;
  return async () => {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Un événement ne sert qu'une fois ; le navigateur en renverra un si on refuse.
    deferred = null;
    emit();
    return outcome === "accepted";
  };
}
