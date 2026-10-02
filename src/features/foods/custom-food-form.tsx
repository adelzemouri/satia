"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { createFoodAction } from "@/features/journal/actions";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

/** Nombre saisi au clavier (virgule acceptée) ; null si le champ est vide. */
export function readNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "")
    .trim()
    .replace(",", ".");
  return raw === "" ? null : Number(raw);
}

export function CustomFoodForm() {
  const t = useTranslations("foods");
  const tCommon = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [basis, setBasis] = useState<"100g" | "portion">("100g");
  const [state, setState] = useState<{ error?: string; fieldErrors?: Record<string, string> } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await createFoodAction({
        name: String(formData.get("name") ?? ""),
        brand: String(formData.get("brand") ?? ""),
        basis,
        portionGrams: basis === "portion" ? readNumber(formData, "portionGrams") : null,
        kcal: readNumber(formData, "kcal"),
        proteinG: readNumber(formData, "proteinG") ?? 0,
        carbsG: readNumber(formData, "carbsG") ?? 0,
        fatG: readNumber(formData, "fatG") ?? 0,
      });
      if (result?.error) setState(result);
      else router.push("/foods");
    });

  const fieldError = (name: string) => errorText(state?.fieldErrors?.[name]);

  return (
    <form action={submit} className="flex flex-col gap-4">
      {state?.error && state.error !== "invalid_form" && <Alert>{errorText(state.error)}</Alert>}
      <Field label={t("name")} name="name" required maxLength={120} error={fieldError("name")} />
      <Field label={`${t("brand")} (${tCommon("optional")})`} name="brand" maxLength={80} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-semibold">{t("basis")}</legend>
        {(["100g", "portion"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="basis"
              value={value}
              checked={basis === value}
              onChange={() => setBasis(value)}
              className="size-5 accent-[var(--color-primary)]"
            />
            {t(value === "100g" ? "basis100" : "basisPortion")}
          </label>
        ))}
      </fieldset>
      {basis === "portion" && (
        <Field
          label={t("portionGrams")}
          name="portionGrams"
          inputMode="decimal"
          required
          error={fieldError("portionGrams")}
        />
      )}
      <Field label={t("kcal")} hint={t("kcalHint")} name="kcal" inputMode="decimal" error={fieldError("kcal")} />
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("protein")} name="proteinG" inputMode="decimal" required error={fieldError("proteinG")} />
        <Field label={t("carbs")} name="carbsG" inputMode="decimal" required error={fieldError("carbsG")} />
        <Field label={t("fat")} name="fatG" inputMode="decimal" required error={fieldError("fatG")} />
      </div>
      <Button type="submit" disabled={pending}>
        {t("create")}
      </Button>
    </form>
  );
}
