"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { analyzePhotoAction, analyzeTextAction, type DraftState } from "./actions";
import { compressImage } from "./compress-image";
import type { MealDraft } from "./draft";
import { useSpeech } from "./use-speech";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

export type AiAvailability = { available: true } | { available: false; reason: string };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Saisie IA : photo (caméra ou galerie) avec une précision facultative et un contenant,
 * ou description dictée ou écrite. Le résultat part vers l'écran de confirmation.
 */
export function AiEntry({
  availability,
  containers,
  onDraft,
}: {
  availability: AiAvailability;
  containers: { id: string; name: string }[];
  onDraft: (draft: MealDraft, photoPreview: string | null) => void;
}) {
  const t = useTranslations("aiEntry");
  const locale = useLocale();
  const errorText = useErrorText();
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [containerId, setContainerId] = useState("");
  const [text, setText] = useState("");
  const [dictated, setDictated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const speech = useSpeech(locale, (spoken) => {
    setText(spoken);
    setDictated(true);
  });

  // L'aperçu local est libéré quand on change de photo ou qu'on quitte l'écran.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  if (!availability.available) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-4" aria-labelledby="ai-title">
        <h2 id="ai-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-text-muted">{errorText(availability.reason)}</p>
      </section>
    );
  }

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  };

  const finish = (result: DraftState, preview: string | null) => {
    if ("error" in result) return setError(result.error);
    onDraft(result.draft, preview);
  };

  const analyzePhoto = () =>
    startTransition(async () => {
      if (!photo) return;
      setError(null);
      try {
        const image = await compressImage(photo.file);
        const result = await analyzePhotoAction({
          imageBase64: await toBase64(image.blob),
          mime: image.mime,
          note: note.trim() || undefined,
          containerId: containerId || null,
        });
        // L'aperçu reste affiché sur l'écran de confirmation : on en crée un nouveau à partir de l'image réduite.
        finish(result, URL.createObjectURL(image.blob));
      } catch {
        setError("photo_unreadable");
      }
    });

  const analyzeText = () =>
    startTransition(async () => {
      setError(null);
      finish(await analyzeTextAction({ text, method: dictated ? "voice" : "text" }), null);
    });

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface-muted p-4" aria-labelledby="ai-title">
      <div className="flex flex-col gap-1">
        <h2 id="ai-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-text-muted">{t("hint")}</p>
      </div>
      {error && <Alert>{errorText(error)}</Alert>}

      {photo ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob) */}
          <img src={photo.preview} alt={t("photoAlt")} className="max-h-64 w-full rounded-2xl object-cover" />
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("note")}</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder={t("noteHint")}
              className={inputClass}
            />
          </label>
          {containers.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("container")}</span>
              <select
                value={containerId}
                onChange={(event) => setContainerId(event.target.value)}
                className={inputClass}
              >
                <option value="">{t("noContainer")}</option>
                {containers.map((container) => (
                  <option key={container.id} value={container.id}>
                    {container.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={analyzePhoto} disabled={pending}>
              {pending ? t("analyzing") : t("analyzePhoto")}
            </Button>
            <Button variant="ghost" onClick={() => setPhoto(null)} disabled={pending}>
              {t("otherPhoto")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className={buttonClass("secondary", "cursor-pointer px-3 focus-within:outline-2")}>
            <Icon name="camera" />
            {t("takePhoto")}
            <input type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only" />
          </label>
          <label className={buttonClass("secondary", "cursor-pointer px-3 focus-within:outline-2")}>
            <Icon name="image" />
            {t("choosePhoto")}
            <input type="file" accept="image/*" onChange={choosePhoto} className="sr-only" />
          </label>
        </div>
      )}

      {!photo && (
        <form action={analyzeText} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("describe")}</span>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (!event.target.value) setDictated(false);
              }}
              rows={2}
              maxLength={500}
              placeholder={t("describeHint")}
              className="rounded-2xl border border-border bg-surface px-3 py-2 text-base"
            />
          </label>
          {speech.error && <p className="text-sm text-text-muted">{errorText(speech.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || text.trim().length < 2}>
              {pending ? t("analyzing") : t("analyzeText")}
            </Button>
            {speech.supported && (
              <Button
                variant="secondary"
                onClick={speech.listening ? speech.stop : speech.start}
                aria-pressed={speech.listening}
                disabled={pending}
              >
                <Icon name="mic" />
                {speech.listening ? t("stopDictation") : t("dictate")}
              </Button>
            )}
          </div>
        </form>
      )}
      <p className="flex flex-wrap gap-x-4 text-sm">
        <Link href="/containers" className="underline">
          {t("containersLink")}
        </Link>
        <Link href="/dictionary" className="underline">
          {t("dictionaryLink")}
        </Link>
      </p>
      <p className="sr-only" aria-live="polite">
        {pending ? t("analyzing") : ""}
      </p>
    </section>
  );
}
