"use client";

import { useTranslations } from "next-intl";

import { INVITE_TTL_DAYS } from "@/config/app";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { createInviteAction } from "./actions";
import { CopyLink } from "./copy-link";

export function InviteForm() {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(createInviteAction, null);
  return (
    <div className="flex flex-col gap-4">
      <form {...action} className="flex flex-col gap-3">
        {state?.error && state.error !== "invalid_form" && <Alert>{errorText(state.error)}</Alert>}
        <Field
          label={t("inviteLabel")}
          name="label"
          required
          maxLength={40}
          error={errorText(state?.fieldErrors?.label)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("inviteRole")}</span>
          <select
            name="role"
            defaultValue="member"
            className="min-h-12 rounded-2xl border border-border bg-surface px-4"
          >
            <option value="member">{t("role.member")}</option>
            <option value="admin">{t("role.admin")}</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {t("inviteSubmit")}
        </Button>
      </form>
      {state?.url && <CopyLink intro={t("linkReady", { days: INVITE_TTL_DAYS })} url={state.url} />}
    </div>
  );
}
