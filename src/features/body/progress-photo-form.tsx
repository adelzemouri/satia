"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { POSES, type Pose } from "@/domain/activity";
import { compressImage, toBase64 } from "@/features/ai/compress-image";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { addProgressPhotoAction } from "./actions";
import { SelectField } from "./select-field";

/** Côté long des photos de progression : assez pour comparer, léger à stocker. */
const PROGRESS_MAX_SIDE = 1080;

export function ProgressPhotoForm({ today }: { today: string }) {
  const t = useTranslations("body.photos");
  const errorText = useErrorText();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const file = formData.get("photo");
      if (!(file instanceof File) || file.size === 0) return setError("invalid_photo");
      try {
        const image = await compressImage(file, { maxSide: PROGRESS_MAX_SIDE, quality: 0.8 });
        const result = await addProgressPhotoAction({
          date: String(formData.get("date")),
          pose: String(formData.get("pose")) as Pose,
          imageBase64: await toBase64(image.blob),
          mime: image.mime,
        });
        setError(result?.error ?? null);
        if (!result?.error) form.current?.reset();
      } catch {
        setError("invalid_photo");
      }
    });

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      {error && <Alert>{errorText(error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t("pose")}
          name="pose"
          options={POSES.map((pose) => ({ value: pose, label: t(`poses.${pose}`) }))}
        />
        <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
      </div>
      <Field label={t("file")} name="photo" type="file" accept="image/*" capture="environment" required />
      <p className="text-sm text-text-muted">{t("privacy")}</p>
      <Button type="submit" disabled={pending}>
        {pending ? t("sending") : t("save")}
      </Button>
    </form>
  );
}
