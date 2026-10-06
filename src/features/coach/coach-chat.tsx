"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import type { CoachQuestion } from "@/domain/coach-questions";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { clearCoachMessagesAction, sendCoachMessageAction } from "./actions";
import { EmptyState } from "@/ui/empty-state";

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  notice: "floor" | "medical" | "care" | null;
};

const MAX_LENGTH = 500;

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
  const errorText = useErrorText();
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sent]);

  const send = (value = text) => {
    const message = value.trim();
    if (!message) return;
    setSent(message);
    setError(null);
    startTransition(async () => {
      const result = await sendCoachMessageAction(message);
      setSent(null);
      if (result?.error) {
        setError(result.error);
      } else {
        setText("");
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
        <ol aria-label={t("conversation")} className="flex flex-col gap-2">
          {messages.map((message) => (
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
          <li ref={end} aria-hidden className="h-0" />
        </ol>
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
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={MAX_LENGTH}
            placeholder={t("askHint")}
            className="rounded-2xl border border-border bg-surface px-3 py-2 text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || text.trim().length === 0}>
            {t("send")}
          </Button>
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
