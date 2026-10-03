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
  const callback = useRef(onText);

  useEffect(() => {
    callback.current = onText;
  });
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    const Speech = recognitionClass();
    if (!Speech) return;
    // Une seule dictée à la fois : relancer pendant qu'une autre tourne la ferait échouer.
    recognition.current?.abort();
    const instance = new Speech();
    instance.lang = locale === "en" ? "en-US" : "fr-FR";
    instance.interimResults = true;
    instance.continuous = false;
    instance.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
      callback.current(text.trim());
    };
    instance.onerror = (event) => setError(speechErrorKey(event.error));
    instance.onend = () => {
      if (recognition.current === instance) setListening(false);
    };
    recognition.current = instance;
    setError(null);
    try {
      instance.start();
      setListening(true);
    } catch {
      setError("speech_failed");
    }
  }, [locale]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
