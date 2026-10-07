"use client";

import { useTranslations } from "next-intl";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { UsernameField } from "@/ui/username-field";
import { useFormAction } from "@/ui/use-form-action";

import { deleteAccountAction } from "./actions";

export function DeleteAccountForm({ email }: { email: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(deleteAccountAction, null);
  return (
    <form {...action} className="flex flex-col gap-3">
      <p>{t("profile.deleteHint")}</p>
      {state?.error && <Alert>{errorText(state.error)}</Alert>}
      <UsernameField value={email} />
      <Field label={t("fields.password")} name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" variant="danger" disabled={pending}>
        {t("profile.deleteSubmit")}
      </Button>
    </form>
  );
}
