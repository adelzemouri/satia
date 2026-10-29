"use client";

import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";

import { describeDevice, type FeedbackKind } from "@/domain/feedback";
import { Icon } from "@/ui/icon";
import { ZoomablePhoto } from "@/ui/photo-viewer";
import { useToast } from "@/ui/toast";

import { setFeedbackHandledAction } from "./actions";
import { usePageLabel } from "./feedback-form";

export type InboxItem = {
  id: string;
  kind: FeedbackKind;
  message: string;
  senderName: string;
  page: string | null;
  appVersion: string | null;
  userAgent: string | null;
  errorDetail: string | null;
  screenshotUrl: string | null;
  handled: boolean;
  when: string;
  createdAt: string;
};

/** Messages à traiter visibles avant « Voir les autres » : la carte reste courte en haut de page. */
export const INBOX_VISIBLE = 5;

/** Texte prêt à coller dans une conversation avec Claude pour corriger ou étudier le message. */
function claudeText(item: InboxItem, kindLabel: string, pageLabel: string | null): string {
  return [
    `Pommelia · ${kindLabel} · ${item.senderName} · ${item.createdAt.slice(0, 10)}`,
    "",
    item.message,
    "",
    pageLabel && `Page : ${pageLabel} (${item.page})`,
    item.appVersion && `Version : ${item.appVersion}`,
    item.userAgent && `Appareil : ${item.userAgent}`,
    item.errorDetail && `Erreur : ${item.errorDetail}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Remarques reçues : une ligne par message à traiter, qui s'ouvre au toucher. Un message traité
 * quitte la liste et rejoint « Traités », replié en bas de la carte.
 */
export function FeedbackInbox({ items }: { items: InboxItem[] }) {
  const t = useTranslations("feedback");
  const toast = useToast();
  const [optimistic, setHandled] = useOptimistic(items, (state, change: { id: string; handled: boolean }) =>
    state.map((item) => (item.id === change.id ? { ...item, handled: change.handled } : item)),
  );
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showHandled, setShowHandled] = useState(false);
  const handledListId = useId();

  const pending = optimistic.filter((item) => !item.handled);
  const handled = optimistic.filter((item) => item.handled);
  const shown = showAll ? pending : pending.slice(0, INBOX_VISIBLE);
  const hiddenCount = pending.length - shown.length;

  const toggle = (item: InboxItem, done: boolean) => {
    setOpen(null);
    startTransition(async () => {
      setHandled({ id: item.id, handled: done });
      await setFeedbackHandledAction(item.id, done);
    });
    if (done)
      toast({
        message: t("inbox.movedToHandled"),
        undo: () => toggle(item, false),
      });
  };

  const row = (item: InboxItem) => (
    <InboxRow
      key={item.id}
      item={item}
      open={open === item.id}
      onToggleOpen={() => setOpen((current) => (current === item.id ? null : item.id))}
      onToggleHandled={() => toggle(item, !item.handled)}
    />
  );

  return (
    <>
      <h2 id="remarques" className="flex scroll-mt-6 flex-wrap items-center gap-2 text-xl font-semibold">
        {t("inbox.title")}
        {pending.length > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-on-accent tabular-nums">
            {t("inbox.new", { count: pending.length })}
          </span>
        )}
      </h2>

      {optimistic.length === 0 ? (
        <p className="text-text-muted">{t("inbox.empty")}</p>
      ) : pending.length === 0 ? (
        <p className="text-text-muted">{t("inbox.allDone")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">{shown.map(row)}</ul>
      )}

      {(hiddenCount > 0 || (showAll && pending.length > INBOX_VISIBLE) || handled.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-border pt-1">
          {hiddenCount > 0 ? (
            <button type="button" className="min-h-11 text-sm font-bold text-primary" onClick={() => setShowAll(true)}>
              {t("inbox.showMore", { count: hiddenCount })}
            </button>
          ) : showAll && pending.length > INBOX_VISIBLE ? (
            <button type="button" className="min-h-11 text-sm font-bold text-primary" onClick={() => setShowAll(false)}>
              {t("inbox.showLess")}
            </button>
          ) : (
            <span />
          )}
          {handled.length > 0 && (
            <button
              type="button"
              aria-expanded={showHandled}
              aria-controls={handledListId}
              className="flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
              onClick={() => setShowHandled((value) => !value)}
            >
              {t("inbox.handledList", { count: handled.length })}
              <span
                className={`transition-transform duration-200 motion-reduce:transition-none ${showHandled ? "rotate-90" : ""}`}
              >
                <Icon name="right" size={16} />
              </span>
            </button>
          )}
        </div>
      )}

      {showHandled && handled.length > 0 && (
        <ul id={handledListId} className="flex flex-col divide-y divide-border">
          {handled.map(row)}
        </ul>
      )}
    </>
  );
}

function InboxRow({
  item,
  open,
  onToggleOpen,
  onToggleHandled,
}: {
  item: InboxItem;
  open: boolean;
  onToggleOpen: () => void;
  onToggleHandled: () => void;
}) {
  const t = useTranslations("feedback");
  const pageLabel = usePageLabel();
  const [copied, setCopied] = useState(false);
  const detailId = useId();
  const context = [
    pageLabel(item.page),
    describeDevice(item.userAgent),
    item.appVersion && t("inbox.version", { version: item.appVersion }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={item.handled ? "text-text-muted" : ""}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggleOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg py-2.5 text-start"
      >
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            item.kind === "bug" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary"
          }`}
        >
          {t(`kinds.${item.kind}`)}
        </span>
        <span className="truncate font-semibold">{item.senderName}</span>
        <span className="flex items-center gap-1 text-sm whitespace-nowrap text-text-muted">
          {item.when}
          <span
            className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          >
            <Icon name="right" size={16} />
          </span>
        </span>
        {!open && <span className="col-span-full truncate text-text-muted">{item.message}</span>}
      </button>

      {open && (
        <div id={detailId} className="flex flex-col gap-2 pb-3">
          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="break-words whitespace-pre-line text-text">{item.message}</p>
              {context && <p className="text-sm text-text-muted">{context}</p>}
            </div>
            {item.screenshotUrl && (
              <ZoomablePhoto
                photo={{ src: item.screenshotUrl, alt: t("inbox.screenshot") }}
                className="shrink-0 self-start overflow-hidden rounded-xl border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée à durée courte */}
                <img src={item.screenshotUrl} alt="" className="h-28 w-20 object-cover" />
              </ZoomablePhoto>
            )}
          </div>
          {item.errorDetail && (
            <details className="text-sm text-text-muted">
              <summary className="cursor-pointer font-semibold">{t("inbox.details")}</summary>
              <p className="mt-1 font-mono text-xs break-all whitespace-pre-line">{item.errorDetail}</p>
            </details>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className="min-h-11 text-sm font-bold text-primary" onClick={onToggleHandled}>
              {item.handled ? t("inbox.reopen") : t("inbox.handle")}
            </button>
            <button
              type="button"
              className="min-h-11 text-sm font-bold text-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(claudeText(item, t(`kinds.${item.kind}`), pageLabel(item.page)));
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? t("inbox.copied") : t("inbox.copy")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
