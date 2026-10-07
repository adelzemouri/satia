"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Sous-ensemble de la Web Speech API utilisé ici (absent des types DOM de TypeScript). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const subscribeNothing = () => () => {};

/** Délai sans aucun texte avant de relancer une dictée restée muette, nombre de relances et pause. */
const SILENT_RESTART_MS = 3000;
const SILENT_RESTARTS = 4;
const RESTART_PAUSE_MS = 1000;

/**
 * Message pour une erreur de la reconnaissance vocale, ou null quand il n'y a rien à dire
 * (`aborted` : la dictée a été arrêtée volontairement ou relancée).
 */
export function speechErrorKey(error: string): string | null {
  switch (error) {
    case "aborted":
      return null;
    case "not-allowed":
      return "speech_denied";
    // Sur iPhone, la dictée du navigateur dépend de la dictée du système.
    case "service-not-allowed":
      return "speech_unavailable";
    case "no-speech":
      return "speech_silent";
    case "audio-capture":
      return "speech_mic";
    case "network":
      return "speech_network";
    default:
      return "speech_failed";
  }
}

/**
 * Dictée par la reconnaissance vocale du navigateur (gratuite, sans API payante).
 * `onText` reçoit le texte reconnu au fil de l'eau ; `supported` est faux sur les
 * navigateurs qui ne la proposent pas (le champ texte reste alors disponible).
 */
export function useSpeech(locale: string, onText: (text: string) => void) {
  // Faux au rendu serveur, puis détecté dans le navigateur.
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => recognitionClass() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  // Dictées vraiment terminées (événement de fin reçu).
  const [ended] = useState(() => new WeakSet<Recognition>());
  const callback = useRef(onText);
  const watchdog = useRef<number | null>(null);

  useEffect(() => {
    callback.current = onText;
  });
  useEffect(
    () => () => {
      if (watchdog.current !== null) window.clearTimeout(watchdog.current);
      recognition.current?.abort();
    },
    [],
  );

  const clearWatchdog = useCallback(() => {
    if (watchdog.current !== null) window.clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);

  const start = useCallback(() => {
    const Speech = recognitionClass();
    if (!Speech) return;
    clearWatchdog();
    // Une seule dictée à la fois : l'ancienne est coupée net, la nouvelle démarre tout de suite.
    const previous = recognition.current;
    recognition.current = null;
    if (previous && !ended.has(previous)) previous.abort();

    const launch = (retriesLeft: number) => {
      const instance = new Speech();
      instance.lang = locale === "en" ? "en-US" : "fr-FR";
      instance.interimResults = true;
      instance.continuous = false;
      instance.onresult = (event) => {
        // Un résultat tardif d'une dictée arrêtée ne doit pas écraser la nouvelle.
        if (recognition.current !== instance) return;
        clearWatchdog();
        const text = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
        callback.current(text.trim());
      };
      instance.onerror = (event) => {
        if (recognition.current !== instance) return;
        clearWatchdog();
        setError(speechErrorKey(event.error));
      };
      instance.onend = () => {
        ended.add(instance);
        if (recognition.current !== instance) return;
        clearWatchdog();
        setListening(false);
      };
      recognition.current = instance;
      setError(null);
      try {
        instance.start();
        setListening(true);
      } catch {
        recognition.current = null;
        setListening(false);
        setError("speech_failed");
        return;
      }
      // Sur iPhone (app installée), une dictée relancée peu après la précédente reste muette : micro
      // ouvert, mais ni texte, ni erreur, ni fin. Sans aucun texte au bout de quelques secondes, on la
      // remplace par une nouvelle, quelques fois au plus ; plus tard, l'iPhone l'accepte.
      if (retriesLeft > 0) {
        watchdog.current = window.setTimeout(() => {
          watchdog.current = null;
          if (recognition.current !== instance) return;
          // Le bouton reste sur « Arrêter » pendant la relance ; « Arrêter » annule aussi la pause.
          recognition.current = null;
          instance.abort();
          // Une pause après l'arrêt : relancée aussitôt, la dictée resterait muette elle aussi.
          watchdog.current = window.setTimeout(() => {
            watchdog.current = null;
            launch(retriesLeft - 1);
          }, RESTART_PAUSE_MS);
        }, SILENT_RESTART_MS);
      }
    };
    launch(SILENT_RESTARTS);
  }, [locale, ended, clearWatchdog]);

  /**
   * Arrêt demandé : le bouton repasse tout de suite en « Dicter » et la dictée est coupée net
   * (le texte déjà reconnu est déjà dans le champ).
   */
  const stop = useCallback(() => {
    clearWatchdog();
    const instance = recognition.current;
    recognition.current = null;
    setListening(false);
    if (instance && !ended.has(instance)) instance.abort();
  }, [ended, clearWatchdog]);

  return { supported, listening, error, start, stop };
}
