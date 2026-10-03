"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { MUSCLES, type Muscle } from "@/domain/training/types";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";

import { addCustomExerciseAction, deleteCustomExerciseAction } from "./actions";
import { ExerciseArt } from "./exercise-art";

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

type CustomExercise = { id: string; name: string; muscle: Muscle; mode: "reps" | "time"; notes: string | null };

/** Exercices personnels : liste, ajout et suppression. */
export function CustomExercises({ items }: { items: CustomExercise[] }) {
  const t = useTranslations("training");
  const errorText = useErrorText();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-text-muted">{t("library.noCustom")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              {/* Pas de mouvement propre : une pose type du groupe musculaire. */}
              <ExerciseArt exerciseId={item.id} muscle={item.muscle} size={56} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{item.name}</span>
                <span className="text-sm text-text-muted">
                  {t(`muscles.${item.muscle}`)} · {t(`library.modes.${item.mode}`)}
                </span>
                {item.notes && <span className="text-sm">{item.notes}</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => void (await deleteCustomExerciseAction(item.id)))}
                aria-label={t("library.deleteLabel", { name: item.name })}
                className="flex size-12 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        ref={form}
        action={(formData) =>
          startTransition(async () => {
            const result = await addCustomExerciseAction({
              name: String(formData.get("name") ?? ""),
              muscle: String(formData.get("muscle")) as Muscle,
              mode: String(formData.get("mode")) === "time" ? "time" : "reps",
              notes: String(formData.get("notes") ?? ""),
            });
            setError(result?.error ?? null);
            if (!result?.error) form.current?.reset();
          })
        }
        className="flex flex-col gap-3"
      >
        <Field label={t("library.name")} name="name" maxLength={80} required />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("library.muscle")}</span>
            <select name="muscle" className={selectClass} defaultValue="core">
              {MUSCLES.map((muscle) => (
                <option key={muscle} value={muscle}>
                  {t(`muscles.${muscle}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("library.mode")}</span>
            <select name="mode" className={selectClass} defaultValue="reps">
              <option value="reps">{t("library.modes.reps")}</option>
              <option value="time">{t("library.modes.time")}</option>
            </select>
          </label>
        </div>
        <Field label={t("library.notes")} name="notes" maxLength={500} />
        {error && <Alert>{errorText(error)}</Alert>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("library.add")}
        </Button>
      </form>
    </div>
  );
}
