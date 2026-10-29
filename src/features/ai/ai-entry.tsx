"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
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
import { DictationScreen } from "./dictation-halo";
import { onQuickStart, type QuickStart } from "./quick-start";
import type { MealDraft } from "./draft";
import { useSpeech } from "./use-speech";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Petite tuile d'entrée (photo, voix, code-barres, texte) ; la photo, la plus rapide, est mise en avant. */
function tileClass(main: boolean, extra = ""): string {
  return `flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-sm font-bold ${
    main ? "bg-primary text-on-primary" : "bg-surface text-text hover:bg-surface-muted"
  } ${extra}`;
}

export type AiAvailability = { available: true } | { available: false; reason: string };

/**
 * Saisie IA : photo (caméra ou galerie) avec une précision facultative,
 * ou description dictée ou écrite. Le résultat part vers l'écran de confirmation.
 */
export function AiEntry({
  availability,
  barcodeHref,
  dictationTitle,
  onDraft,
  onWrite,
}: {
  availability: AiAvailability;
  /** Le scan de code-barres complète les trois grandes entrées de l'écran d'ajout. */
  barcodeHref: ComponentProps<typeof Link>["href"];
  /** En-tête de l'écran de dictée plein écran (titre et choix du repas). */
  dictationTitle?: ReactNode;
  onDraft: (draft: MealDraft, photoPreview: string | null) => void;
  /** Écrire le repas se fait dans le grand champ de l'écran d'ajout : la dictée à corriger y est versée. */
  onWrite: (text: string, dictated: boolean) => void;
}) {
  const t = useTranslations("aiEntry");
  const locale = useLocale();
  const errorText = useErrorText();
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [dictated, setDictated] = useState(false);
  // Repas dicté : la phrase reste en grand (DictationHalo) jusqu'à l'analyse, même quand la
  // dictée s'arrête ; pour corriger, elle part dans le grand champ de l'écran d'ajout.
  const [voice, setVoice] = useState(false);
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
    setVoice(true);
    speech.start();
  };

  // Départ rapide depuis l'appareil photo du + : la photo déjà prise, la dictée à lancer ou le texte à écrire.
  const quickStart = useEffectEvent((start: QuickStart) => {
    if (!availability.available) return;
    setError(null);
    if (start.kind === "photo") {
      setVoice(false);
      setPhoto({ file: start.file, preview: URL.createObjectURL(start.file) });
      return;
    }
    setPhoto(null);
    if (start.kind === "write" || !speech.supported) {
      setVoice(false);
      return onWrite("", false);
    }
    if (!speech.listening) dictate();
  });
  useEffect(() => onQuickStart(quickStart), []);

  // L'aperçu local est libéré quand on change de photo ou qu'on quitte l'écran.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  const barcodeTile = (
    <Link href={barcodeHref} className={tileClass(false)}>
      <Icon name="barcode" size={24} />
      {t("barcodeShort")}
    </Link>
  );

  if (!availability.available) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="ai-title">
        <h2 id="ai-title" className="sr-only">
          {t("title")}
        </h2>
        <div className="grid grid-cols-3 gap-2">{barcodeTile}</div>
        <p className="text-sm text-text-muted">{errorText(availability.reason)}</p>
      </section>
    );
  }

  // Sans dictée dans ce navigateur, la voix renvoie au grand champ.
  const speak = () => {
    if (!speech.supported) return onWrite("", false);
    if (!speech.listening) dictate();
  };

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  };

  const cancel = () => {
    speech.stop();
    setVoice(false);
  };

  // « Corriger le texte » ou « Écrire à la place » : la phrase dictée passe dans le grand champ.
  const edit = () => {
    speech.stop();
    setVoice(false);
    onWrite(text, dictated);
    setText("");
    setDictated(false);
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
      if (speech.listening) speech.stop();
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
        !voice && (
          <>
            {/* Une seule rangée : l'appareil photo complet est déjà derrière le + ; ici, sans « capture »,
                le téléphone propose lui-même l'appareil photo ou la galerie. Écrire, c'est le grand champ. */}
            <div className="grid grid-cols-3 gap-2">
              <label className={tileClass(true, "cursor-pointer focus-within:outline-2")}>
                <Icon name="camera" size={24} />
                {t("photo")}
                <input type="file" accept="image/*" onChange={choosePhoto} className="sr-only" />
              </label>
              <button type="button" onClick={speak} className={tileClass(false)}>
                <Icon name="mic" size={24} />
                {t("voice")}
              </button>
              {barcodeTile}
            </div>
          </>
        )
      )}

      {!photo && voice && (
        <DictationScreen
          title={dictationTitle}
          onClose={cancel}
          action={analyzeText}
          text={text}
          listening={speech.listening}
          error={speech.error ? errorText(speech.error) : null}
          pending={pending}
          onMic={dictate}
          onStop={speech.stop}
          onEdit={edit}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {pending ? t("analyzing") : ""}
      </p>
    </section>
  );
}
