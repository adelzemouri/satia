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

  useEffect(() => {
    callback.current = onText;
  });
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    const Speech = recognitionClass();
    if (!Speech) return;
    // Une seule dictée à la fois : l'ancienne est coupée net. Sur iPhone, lancer la nouvelle
    // avant que l'ancienne soit vraiment terminée la fait échouer en silence : on attend sa fin
    // (au plus une demi-seconde).
    const previous = recognition.current;
    recognition.current = null;
    const launch = () => {
      const instance = new Speech();
      instance.lang = locale === "en" ? "en-US" : "fr-FR";
      instance.interimResults = true;
      instance.continuous = false;
      // Safari sur iPhone termine sans texte ni erreur quand il ne reconnaît pas le mot
      // (« msemen ») : il faut le dire, sinon l'écran revient à « prêt » sans explication.
      let heard = false;
      let failed = false;
      instance.onresult = (event) => {
        // Un résultat tardif d'une dictée arrêtée ne doit pas écraser la nouvelle.
        if (recognition.current !== instance) return;
        const text = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
        if (text.trim()) heard = true;
        callback.current(text.trim());
      };
      instance.onerror = (event) => {
        failed = true;
        if (recognition.current === instance) setError(speechErrorKey(event.error));
      };
      instance.onend = () => {
        ended.add(instance);
        if (recognition.current !== instance) return;
        setListening(false);
        if (!heard && !failed) setError("speech_unrecognized");
      };
      recognition.current = instance;
      setError(null);
      try {
        instance.start();
        setListening(true);
      } catch {
        setListening(false);
        setError("speech_failed");
      }
    };
    if (!previous || ended.has(previous)) {
      launch();
      return;
    }
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      launch();
    };
    const previousEnd = previous.onend;
    previous.onend = () => {
      previousEnd?.();
      go();
    };
    previous.abort();
    window.setTimeout(go, 500);
  }, [locale, ended]);

  /**
   * Arrêt demandé : le bouton repasse tout de suite en « Dicter ». Safari sur iPhone ne
   * signale pas toujours la fin de la dictée ; sans cela le bouton restait bloqué sur « Arrêter »
   * et une nouvelle dictée devenait impossible.
   */
  const stop = useCallback(() => {
    const instance = recognition.current;
    setListening(false);
    if (!instance) return;
    instance.stop();
    window.setTimeout(() => {
      if (!ended.has(instance)) instance.abort();
    }, 1500);
  }, [ended]);

  return { supported, listening, error, start, stop };
}
