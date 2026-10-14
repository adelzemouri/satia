"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type ComponentProps,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

import { analyzePhotoAction, analyzeTextAction, type DraftState } from "./actions";
import { compressImage, toBase64 } from "./compress-image";
import { DictationHalo } from "./dictation-halo";
import { onQuickStart, type QuickStart } from "./quick-start";
import type { MealDraft } from "./draft";
import { useSpeech } from "./use-speech";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Grande tuile d'entrée (photo, voix, code-barres) ; la photo, la plus rapide, est mise en avant. */
function tileClass(main: boolean, extra = ""): string {
  return `flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center font-bold ${
    main ? "bg-primary text-on-primary" : "bg-surface text-text hover:bg-surface-muted"
  } ${extra}`;
}

export type AiAvailability = { available: true } | { available: false; reason: string };

/**
 * Saisie IA : photo (caméra ou galerie) avec une précision facultative et un contenant,
 * ou description dictée ou écrite. Le résultat part vers l'écran de confirmation.
 */
export function AiEntry({
  availability,
  containers,
  barcodeHref,
  onDraft,
}: {
  availability: AiAvailability;
  containers: { id: string; name: string }[];
  /** Le scan de code-barres complète les trois grandes entrées de l'écran d'ajout. */
  barcodeHref: ComponentProps<typeof Link>["href"];
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
  const [describing, setDescribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Une nouvelle dictée complète le texte déjà là au lieu de l'effacer.
  const before = useRef("");
  const speech = useSpeech(locale, (spoken) => {
    setText(`${before.current}${spoken}`);
    setDictated(true);
  });
  const dictate = () => {
    before.current = text.trim() ? `${text.trim()} ` : "";
    speech.start();
  };

  // Départ rapide depuis le + de la barre du bas : la photo déjà prise, ou la dictée à lancer.
  const quickStart = useEffectEvent((start: QuickStart) => {
    if (!availability.available) return;
    setError(null);
    if (start.kind === "photo") {
      setDescribing(false);
      setPhoto({ file: start.file, preview: URL.createObjectURL(start.file) });
      return;
    }
    setPhoto(null);
    setDescribing(true);
    if (speech.supported && !speech.listening) dictate();
  });
  useEffect(() => onQuickStart(quickStart), []);

  // L'aperçu local est libéré quand on change de photo ou qu'on quitte l'écran.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  const barcodeTile = (
    <Link href={barcodeHref} className={tileClass(false)}>
      <Icon name="barcode" size={28} />
      {t("barcode")}
    </Link>
  );

  if (!availability.available) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="ai-title">
        <h2 id="ai-title" className="sr-only">
          {t("title")}
        </h2>
        <div className="grid grid-cols-3 gap-3">{barcodeTile}</div>
        <p className="text-sm text-text-muted">{errorText(availability.reason)}</p>
      </section>
    );
  }

  const speak = () => {
    setDescribing(true);
    if (speech.supported && !speech.listening) dictate();
  };

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
    <section className="flex flex-col gap-4" aria-labelledby="ai-title">
      <h2 id="ai-title" className="sr-only">
        {t("title")}
      </h2>
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
        !describing && (
          <>
            {/* La photo est le geste le plus rapide : elle prend toute la largeur, voix et code-barres en dessous. */}
            <label className="flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl bg-primary px-5 text-on-primary focus-within:outline-2">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-on-primary/15">
                <Icon name="camera" size={30} />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-bold">{t("takePhoto")}</span>
                <span className="text-sm">{t("takePhotoHint")}</span>
              </span>
              <input type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={speak} className={tileClass(false)}>
                <Icon name="mic" size={28} />
                {t("voice")}
              </button>
              {barcodeTile}
            </div>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-primary">
              <label className="flex min-h-11 cursor-pointer items-center underline-offset-4 focus-within:outline-2 hover:underline">
                {t("choosePhoto")}
                <input type="file" accept="image/*" onChange={choosePhoto} className="sr-only" />
              </label>
              <button
                type="button"
                onClick={() => setDescribing(true)}
                className="min-h-11 underline-offset-4 hover:underline"
              >
                {t("write")}
              </button>
            </p>
          </>
        )
      )}

      {!photo && describing && (
        <form action={analyzeText} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
          {/* Pendant la dictée, la phrase s'écrit en grand avec le micro animé ; le champ revient
              à l'arrêt pour corriger le texte. */}
          {speech.listening ? (
            <DictationHalo text={text} />
          ) : (
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
          )}
          {speech.error && <p className="text-sm text-text-muted">{errorText(speech.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || text.trim().length < 2}>
              {pending ? t("analyzing") : t("analyzeText")}
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
            <Button
              variant="ghost"
              onClick={() => {
                speech.stop();
                setDescribing(false);
              }}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {(photo || describing) && (
        <p className="flex flex-wrap gap-x-4 text-sm">
          <Link href="/containers" className="underline">
            {t("containersLink")}
          </Link>
          <Link href="/dictionary" className="underline">
            {t("dictionaryLink")}
          </Link>
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {pending ? t("analyzing") : ""}
      </p>
    </section>
  );
}
