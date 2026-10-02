"use client";

import { useTranslations } from "next-intl";

import { PASSWORD_MIN } from "./schemas";

type Code = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/** Traduit un code d'erreur renvoyé par une action serveur ou une validation Zod. */
export function useErrorText() {
  const t = useTranslations("errors");
  return (code: string | null | undefined, values: Record<string, string | number> = {}): string | null => {
    if (!code || code === "invalid_form") return null;
    const key = (t.has(code as Code) ? code : "generic") as Code;
    return t(key, { min: PASSWORD_MIN, ...values } as never);
  };
}
