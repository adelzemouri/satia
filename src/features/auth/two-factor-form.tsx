"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { verifyTwoFactorAction } from "./actions";
import { useErrorText } from "./use-error-text";

export function TwoFactorForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [state, action, pending] = useFormAction(verifyTwoFactorAction, null);

  return (
    <form {...action} className="flex flex-col gap-4" noValidate>
      {state?.error && <Alert>{errorText(state.error === "invalid_form" ? "invalid_code" : state.error)}</Alert>}
      <input type="hidden" name="method" value={method} />
      {method === "totp" ? (
        <Field
          key="totp"
          label={t("fields.code")}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
      ) : (
        <Field key="backup" label={t("fields.backupCode")} name="code" autoComplete="off" required />
      )}
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="trustDevice" className="size-5 accent-[var(--color-primary)]" />
        {t("twoFactor.trustDevice")}
      </label>
      <Button type="submit" disabled={pending}>
        {t("twoFactor.submit")}
      </Button>
      <Button variant="ghost" onClick={() => setMethod(method === "totp" ? "backup" : "totp")}>
        {method === "totp" ? t("twoFactor.useBackup") : t("twoFactor.useTotp")}
      </Button>
    </form>
  );
}
