"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { loginAction } from "./actions";
import { useErrorText } from "./use-error-text";

export function LoginForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(loginAction, null);
  const fieldError = (name: string) => errorText(state?.fieldErrors?.[name]);

  return (
    <form {...action} className="flex flex-col gap-4" noValidate>
      {state?.error && state.error !== "invalid_form" && <Alert>{errorText(state.error)}</Alert>}
      <Field
        label={t("fields.email")}
        name="email"
        type="email"
        autoComplete="username"
        required
        error={fieldError("email")}
      />
      <Field
        label={t("fields.password")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />
      <Button type="submit" disabled={pending}>
        {t("login.submit")}
      </Button>
      <p className="text-sm text-text-muted">{t("login.noAccount")}</p>
    </form>
  );
}
