"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { resetPasswordAction } from "./actions";
import { PASSWORD_MIN } from "./schemas";
import { useErrorText } from "./use-error-text";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(resetPasswordAction, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t("reset.done")}</Alert>
        <Link href="/login" className={buttonClass()}>
          {t("login.submit")}
        </Link>
      </div>
    );
  }
  return (
    <form {...action} className="flex flex-col gap-4" noValidate>
      {state?.error && state.error !== "invalid_form" && <Alert>{errorText(state.error)}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("fields.newPassword")}
        hint={t("fields.passwordHint", { min: PASSWORD_MIN })}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
        error={errorText(state?.fieldErrors?.password)}
      />
      <Button type="submit" disabled={pending}>
        {t("reset.submit")}
      </Button>
    </form>
  );
}
