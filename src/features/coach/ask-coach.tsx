"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { type CoachTopic, TOPIC_QUESTIONS } from "@/domain/coach-topic";
import { useSpeech } from "@/features/ai/use-speech";
import { useErrorText } from "@/features/auth/use-error-text";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { askCoachAction, type CoachAnswer } from "./actions";
import { CoachAvatar } from "./coach-avatar";

const MAX_LENGTH = 500;

type Exchange = { id: number; question: string; answer: CoachAnswer | null };

/**
 * « Demander à Pépin » depuis une page : un panneau monte par-dessus la page (sur le côté sur
 * ordinateur) avec le sujet déjà joint. Les échanges rejoignent la conversation de /coach.
 */
export function AskCoach({
  topic,
  label,
  coachName,
  compact = false,
  className = "",
}: {
  topic: CoachTopic;
  /** Ce dont on parle, en clair (« Déjeuner · 640 kcal »). */
  label: string;
  coachName: string;
  /** Bouton discret, pour l'en-tête d'une carte. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("coach");
  const locale = useLocale();
  const errorText = useErrorText();
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextId = useRef(0);

  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [exchanges]);

  const before = useRef("");
  const speech = useSpeech(locale, (spoken) => setText(`${before.current}${spoken}`));
  const dictate = () => {
    before.current = text.trim() ? `${text.trim()} ` : "";
    speech.start();
  };

  const send = (value = text) => {
    const question = value.trim();
    if (!question || pending) return;
    speech.stop();
    const typed = value === text;
    if (typed) setText("");
    const id = (nextId.current += 1);
    setExchanges((list) => [...list, { id, question, answer: null }]);
    setError(null);
    startTransition(async () => {
      const result = await askCoachAction(question, topic);
      if ("answer" in result) {
        setExchanges((list) => list.map((item) => (item.id === id ? { ...item, answer: result.answer } : item)));
      } else {
        setExchanges((list) => list.filter((item) => item.id !== id));
        setError(result.error);
        if (typed) setText((current) => current || question);
      }
    });
  };

  const close = () => {
    speech.stop();
    dialog.current?.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`flex shrink-0 items-center gap-2 rounded-full bg-primary-soft font-semibold text-primary transition active:scale-[0.97] ${
          compact ? "min-h-11 py-1 pr-3 pl-1 text-sm" : "min-h-12 py-1.5 pr-5 pl-1.5"
        } ${className}`}
      >
        <CoachAvatar size={compact ? 28 : 32} />
        {t("askCoach", { name: coachName })}
      </button>

      {/* Échap et le bouton Fermer ferment au clavier ; le clic sur le fond grisé est un raccourci tactile. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        aria-labelledby={`ask-coach-${topicKey(topic)}`}
        onClick={(event) => {
          // Un toucher sur le fond grisé ferme le panneau.
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => speech.stop()}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-text backdrop:bg-black/40 lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[26rem] lg:rounded-t-none lg:rounded-l-3xl"
      >
        <div className="flex max-h-[85dvh] flex-col gap-3 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:h-full lg:max-h-none lg:pt-6">
          <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border lg:hidden" />
          <div className="flex items-center gap-3">
            <CoachAvatar size={40} />
            <h2 id={`ask-coach-${topicKey(topic)}`} className="flex-1 font-display text-xl font-extrabold">
              {coachName}
            </h2>
            <Button variant="ghost" onClick={close} aria-label={t("closePanel")} className="min-h-11 px-3">
              <Icon name="close" />
            </Button>
          </div>
          <p className="self-start rounded-xl bg-surface-muted px-3 py-1 text-sm text-text-muted">
            {t("about", { label })}
          </p>

          {exchanges.length > 0 && (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- cadre défilant atteignable au clavier
            <div ref={scroller} tabIndex={0} className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
              <ol aria-label={t("conversation")} className="flex flex-col gap-2">
                {exchanges.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2">
                    <p className="max-w-[85%] self-end rounded-2xl bg-primary-soft px-4 py-2 whitespace-pre-line">
                      <span className="sr-only">{t("you")} : </span>
                      {item.question}
                    </p>
                    {item.answer ? (
                      <p className="max-w-[85%] self-start rounded-2xl bg-surface-muted px-4 py-2 whitespace-pre-line">
                        <span className="sr-only">{coachName} : </span>
                        {item.answer.notice ? t(`notices.${item.answer.notice}`) : item.answer.content}
                      </p>
                    ) : (
                      <p role="status" className="text-sm text-text-muted">
                        {t("thinking", { name: coachName })}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {error && <Alert>{errorText(error)}</Alert>}

          {exchanges.length === 0 && (
            <ul aria-label={t("suggestions")} className="flex flex-wrap gap-2">
              {TOPIC_QUESTIONS[topic.kind].map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => send(t(`topicQuestions.${key}`))}
                    className="min-h-11 rounded-full border border-border bg-surface-muted px-4 py-2 text-left text-sm font-semibold disabled:opacity-60"
                  >
                    {t(`topicQuestions.${key}`)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col">
              <span className="sr-only">{t("ask")}</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={1}
                enterKeyHint="send"
                maxLength={MAX_LENGTH}
                placeholder={t("askTopicHint")}
                className="min-h-12 resize-none rounded-3xl border border-border bg-surface px-4 py-3 text-base"
              />
            </label>
            {speech.supported && (
              <Button
                variant="secondary"
                onClick={speech.listening ? speech.stop : dictate}
                aria-pressed={speech.listening}
                aria-label={speech.listening ? t("stopDictation") : t("dictate")}
                disabled={pending}
                className="px-3"
              >
                <Icon name="mic" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={pending || text.trim().length === 0}
              aria-label={t("send")}
              className="px-3"
            >
              <Icon name="right" />
            </Button>
          </form>
          {speech.error && <p className="text-sm text-text-muted">{errorText(speech.error)}</p>}
          <Link
            href="/coach"
            className="self-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("openFull")}
          </Link>
        </div>
      </dialog>
    </>
  );
}

function topicKey(topic: CoachTopic): string {
  return topic.kind === "food" ? topic.id : topic.kind === "meal" ? `${topic.date}-${topic.slot}` : topic.date;
}
