"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import type { CoachQuestion } from "@/domain/coach-questions";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useSpeech } from "@/features/ai/use-speech";

import { clearCoachMessagesAction, sendCoachMessageAction } from "./actions";
import { EmptyState } from "@/ui/empty-state";

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  notice: "floor" | "medical" | "care" | null;
};

const MAX_LENGTH = 500;
/** Messages affichés d'abord, puis par tranche avec « Messages précédents ». */
const PAGE = 10;

/** Conversation avec le coach : fil des messages, champ de saisie et effacement. */
export function CoachChat({
  messages,
  coachName,
  questions,
  ask,
}: {
  messages: ChatMessage[];
  coachName: string;
  /** Questions toutes prêtes, proposées en boutons au-dessus du champ. */
  questions: CoachQuestion[];
  /** Question choisie sur l'accueil : envoyée dès l'ouverture de la page. */
  ask: CoachQuestion | null;
}) {
  const t = useTranslations("coach");
  const locale = useLocale();
  const errorText = useErrorText();
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(PAGE);
  // La conversation défile dans son propre cadre : la page reste en haut (bilan de la semaine),
  // et seul le cadre se place sur le dernier message.
  const scroller = useRef<HTMLDivElement>(null);
  const keepOffset = useRef<number | null>(null);

  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, sent]);

  // Après « Messages précédents », le message lu reste au même endroit.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || keepOffset.current === null) return;
    box.scrollTop = box.scrollHeight - keepOffset.current;
    keepOffset.current = null;
  }, [shown]);

  const showEarlier = () => {
    const box = scroller.current;
    if (box) keepOffset.current = box.scrollHeight - box.scrollTop;
    setShown((count) => count + PAGE);
  };
  const visible = messages.slice(-shown);
  const hidden = messages.length - visible.length;

  // Une nouvelle dictée complète le texte déjà là au lieu de l'effacer.
  const before = useRef("");
  const speech = useSpeech(locale, (spoken) => setText(`${before.current}${spoken}`));
  const dictate = () => {
    before.current = text.trim() ? `${text.trim()} ` : "";
    speech.start();
  };

  const send = (value = text) => {
    const message = value.trim();
    if (!message || pending) return;
    speech.stop();
    // Le champ se vide tout de suite : le message part dans le fil pendant que Pépin répond.
    // En cas d'échec, le texte revient dans le champ pour être renvoyé.
    const typed = value === text;
    if (typed) setText("");
    setSent(message);
    setError(null);
    startTransition(async () => {
      const result = await sendCoachMessageAction(message);
      setSent(null);
      if (result?.error) {
        setError(result.error);
        if (typed) setText((current) => current || message);
      }
    });
  };

  // Question venue de l'accueil : posée une seule fois, puis retirée de l'adresse pour qu'un
  // rechargement de la page ne la renvoie pas.
  const asked = useRef(false);
  useEffect(() => {
    if (!ask || asked.current) return;
    asked.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    send(t(`questions.${ask}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  const clear = () =>
    startTransition(async () => {
      const result = await clearCoachMessagesAction();
      setError(result?.error ?? null);
    });

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 && !sent ? (
        <EmptyState scene="chat">{t("empty")}</EmptyState>
      ) : (
        // Cadre défilant atteignable au clavier (axe : scrollable-region-focusable).
        <div
          ref={scroller}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="-mx-2 max-h-[60vh] overflow-y-auto overscroll-contain px-2 lg:max-h-[max(18rem,calc(100dvh-37rem))]"
        >
          {hidden > 0 && (
            <div className="flex justify-center pb-2">
              <Button variant="ghost" onClick={showEarlier}>
                {t("earlier", { count: hidden })}
              </Button>
            </div>
          )}
          <ol aria-label={t("conversation")} className="flex flex-col gap-2">
            {visible.map((message) => (
              <Bubble key={message.id} from={message.role} label={message.role === "user" ? t("you") : coachName}>
                {message.notice ? t(`notices.${message.notice}`) : message.content}
              </Bubble>
            ))}
            {sent && (
              <>
                <Bubble from="user" label={t("you")}>
                  {sent}
                </Bubble>
                <li role="status" className="text-sm text-text-muted">
                  {t("thinking", { name: coachName })}
                </li>
              </>
            )}
          </ol>
        </div>
      )}

      {error && <Alert>{errorText(error)}</Alert>}

      {questions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-muted">{t("suggestions")}</h3>
          <ul data-swipe-lock className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {questions.map((question) => (
              <li key={question} className="shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => send(t(`questions.${question}`))}
                  className="min-h-11 rounded-full border border-border bg-surface-muted px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {t(`questions.${question}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("ask")}</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Entrée envoie, Maj+Entrée va à la ligne ; rien pendant la saisie d'un caractère composé.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            rows={2}
            enterKeyHint="send"
            maxLength={MAX_LENGTH}
            placeholder={t("askHint")}
            className="rounded-2xl border border-border bg-surface px-3 py-2 text-base"
          />
        </label>
        {speech.error && <p className="text-sm text-text-muted">{errorText(speech.error)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || text.trim().length === 0}>
            {t("send")}
          </Button>
          {speech.supported && (
            <Button
              variant="secondary"
              onClick={speech.listening ? speech.stop : dictate}
              aria-pressed={speech.listening}
              disabled={pending}
            >
              <Icon name="mic" />
              {speech.listening ? t("stopDictation") : t("dictate")}
            </Button>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" onClick={clear} disabled={pending}>
              {t("clear")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Bubble({ from, label, children }: { from: ChatMessage["role"]; label: string; children: React.ReactNode }) {
  const mine = from === "user";
  return (
    <li
      className={`flex max-w-[85%] flex-col gap-0.5 rounded-2xl px-4 py-2 ${
        mine ? "self-end bg-primary-soft" : "self-start bg-surface-muted"
      }`}
    >
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <span className="whitespace-pre-line">{children}</span>
    </li>
  );
}
