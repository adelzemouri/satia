"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { describeDevice, type FeedbackKind } from "@/domain/feedback";
import { ZoomablePhoto } from "@/ui/photo-viewer";

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

export function FeedbackInbox({ items }: { items: InboxItem[] }) {
  const t = useTranslations("feedback");
  const pageLabel = usePageLabel();
  const [optimistic, setHandled] = useOptimistic(items, (state, change: { id: string; handled: boolean }) =>
    state.map((item) => (item.id === change.id ? { ...item, handled: change.handled } : item)),
  );
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  if (optimistic.length === 0) return <p className="text-text-muted">{t("inbox.empty")}</p>;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {optimistic.map((item) => {
        const context = [
          pageLabel(item.page),
          describeDevice(item.userAgent),
          item.appVersion && t("inbox.version", { version: item.appVersion }),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={item.id} className={`flex flex-col gap-2 py-3 ${item.handled ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  item.kind === "bug" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary"
                }`}
              >
                {t(`kinds.${item.kind}`)}
              </span>
              <span className="font-semibold">{item.senderName}</span>
              <span className="ms-auto text-sm text-text-muted">{item.when}</span>
            </div>
            <p className="break-words whitespace-pre-line">{item.message}</p>
            {context && <p className="text-sm text-text-muted">{context}</p>}
            {item.errorDetail && (
              <details className="text-sm text-text-muted">
                <summary className="cursor-pointer font-semibold">{t("inbox.details")}</summary>
                <p className="mt-1 font-mono text-xs break-all whitespace-pre-line">{item.errorDetail}</p>
              </details>
            )}
            {item.screenshotUrl && (
              <ZoomablePhoto
                photo={{ src: item.screenshotUrl, alt: t("inbox.screenshot") }}
                className="self-start overflow-hidden rounded-xl border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée à durée courte */}
                <img src={item.screenshotUrl} alt="" className="h-28 w-20 object-cover" />
              </ZoomablePhoto>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                className="min-h-11 text-sm font-bold text-primary"
                onClick={() =>
                  startTransition(async () => {
                    setHandled({ id: item.id, handled: !item.handled });
                    await setFeedbackHandledAction(item.id, !item.handled);
                  })
                }
              >
                {item.handled ? t("inbox.reopen") : t("inbox.handle")}
              </button>
              <button
                type="button"
                className="min-h-11 text-sm font-bold text-primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      claudeText(item, t(`kinds.${item.kind}`), pageLabel(item.page)),
                    );
                    setCopied(item.id);
                  } catch {
                    setCopied(null);
                  }
                }}
              >
                {copied === item.id ? t("inbox.copied") : t("inbox.copy")}
              </button>
              {item.handled && (
                <span className="min-h-11 content-center text-sm text-text-muted">{t("inbox.handled")}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
