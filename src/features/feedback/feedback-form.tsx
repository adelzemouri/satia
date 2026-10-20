"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useSyncExternalStore, useTransition } from "react";

import { describeDevice, FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, type FeedbackKind } from "@/domain/feedback";
import { compressImage, toBase64 } from "@/features/ai/compress-image";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { sendFeedbackAction } from "./actions";

/** Côté long des captures : l'écran reste lisible, le fichier léger. */
const SCREENSHOT_MAX_SIDE = 1280;

const noSubscribe = () => () => {};

/** Libellé lisible d'une page de l'app (« Journal »), sinon son chemin. */
export function usePageLabel() {
  const t = useTranslations("feedback.pages");
  return (path: string | null) => {
    if (!path) return null;
    const segment = path.split("/")[1] ?? "";
    const key = segment === "" ? "home" : segment;
    return t.has(key as never) ? t(key as never) : path;
  };
}

/** Formulaire de remarque ou de bug : type, texte, capture facultative, contexte affiché. */
export function FeedbackForm({
  page,
  defaultKind = "remark",
  errorDetail,
  onSent,
}: {
  page: string;
  defaultKind?: FeedbackKind;
  errorDetail?: string;
  onSent: () => void;
}) {
  const t = useTranslations("feedback");
  const errorText = useErrorText();
  const pageLabel = usePageLabel();
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>(defaultKind);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<{ file: File; url: string } | null>(null);
  const device = useSyncExternalStore(
    noSubscribe,
    () => describeDevice(navigator.userAgent),
    () => null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => (screenshot ? URL.revokeObjectURL(screenshot.url) : undefined), [screenshot]);

  const submit = () =>
    startTransition(async () => {
      if (!message.trim()) return setError("feedback_empty");
      try {
        const image = screenshot
          ? await compressImage(screenshot.file, { maxSide: SCREENSHOT_MAX_SIDE, quality: 0.8 })
          : null;
        const result = await sendFeedbackAction({
          kind,
          message,
          page,
          errorDetail: errorDetail ?? null,
          screenshot: image ? { base64: await toBase64(image.blob), mime: image.mime } : null,
        });
        if (result?.error) return setError(result.error);
        onSent();
      } catch {
        setError("invalid_photo");
      }
    });

  const context = [t("contextPage", { page: pageLabel(page) ?? page }), device].filter(Boolean).join(" · ");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      {error && <Alert>{errorText(error)}</Alert>}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t("kindLegend")}</legend>
        <div className="flex gap-2">
          {FEEDBACK_KINDS.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 font-semibold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]"
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {t(`kinds.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="font-semibold">
          {t(kind === "bug" ? "messageBug" : "messageRemark")}
        </label>
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (error === "feedback_empty") setError(null);
          }}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={4}
          placeholder={t(kind === "bug" ? "placeholderBug" : "placeholderRemark")}
          className="min-h-28 rounded-2xl border border-border bg-surface px-4 py-3 text-base"
        />
      </div>
      {screenshot ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), rien à optimiser */}
          <img
            src={screenshot.url}
            alt={t("screenshotPreview")}
            className="h-20 w-14 rounded-lg border border-border object-cover"
          />
          <span className="flex-1 text-sm text-text-muted">{t("screenshotAdded")}</span>
          <button
            type="button"
            onClick={() => setScreenshot(null)}
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-primary"
          >
            {t("screenshotRemove")}
          </button>
        </div>
      ) : (
        <label className="flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-2xl border border-dashed border-border px-4 font-semibold text-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]">
          <Icon name="image" size={20} />
          {t("screenshotAdd")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setScreenshot({ file, url: URL.createObjectURL(file) });
              event.target.value = "";
            }}
          />
        </label>
      )}
      <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text-muted">{t("context", { context })}</p>
      <Button type="submit" disabled={pending}>
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
