"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { acceptInviteAction } from "./actions";
import { PASSWORD_MIN } from "./schemas";
import { useErrorText } from "./use-error-text";

export function InviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(acceptInviteAction, null);
  const fieldError = (name: string) => errorText(state?.fieldErrors?.[name]);

  return (
    <form {...action} className="flex flex-col gap-4" noValidate>
      {state?.error && state.error !== "invalid_form" && <Alert>{errorText(state.error)}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("fields.name")}
        name="name"
        autoComplete="given-name"
        defaultValue={defaultName}
        required
        error={fieldError("name")}
      />
      <Field
        label={t("fields.email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={fieldError("email")}
      />
      <Field
        label={t("fields.password")}
        hint={t("fields.passwordHint", { min: PASSWORD_MIN })}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
        error={fieldError("password")}
      />
      <Button type="submit" disabled={pending}>
        {t("invite.submit")}
      </Button>
    </form>
  );
}
