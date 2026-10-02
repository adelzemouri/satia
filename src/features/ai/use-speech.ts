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
  const callback = useRef(onText);

  useEffect(() => {
    callback.current = onText;
  });
  useEffect(() => () => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Speech = recognitionClass();
    if (!Speech) return;
    const instance = new Speech();
    instance.lang = locale === "en" ? "en-US" : "fr-FR";
    instance.interimResults = true;
    instance.continuous = false;
    instance.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
      callback.current(text.trim());
    };
    instance.onerror = (event) => setError(event.error === "not-allowed" ? "speech_denied" : "speech_failed");
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setError(null);
    setListening(true);
    instance.start();
  }, [locale]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
