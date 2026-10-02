"use client";

import { useTranslations } from "next-intl";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { confirmTwoFactorAction, disableTwoFactorAction, enableTwoFactorAction } from "./actions";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [enableState, enable, enabling] = useFormAction(enableTwoFactorAction, null);
  const [confirmState, confirm, confirming] = useFormAction(confirmTwoFactorAction, null);
  const [disableState, disable, disabling] = useFormAction(disableTwoFactorAction, null);

  if (enabled) {
    return (
      <form {...disable} className="flex flex-col gap-3">
        <Alert tone="success">{t("profile.twoFactorOn")}</Alert>
        {disableState?.error && <Alert>{errorText(disableState.error)}</Alert>}
        <Field label={t("fields.password")} name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" variant="secondary" disabled={disabling}>
          {t("profile.disable2fa")}
        </Button>
      </form>
    );
  }

  if (enableState?.qrSvg) {
    return (
      <div className="flex flex-col gap-4">
        <p>{t("profile.scanQr")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG généré côté serveur */}
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enableState.qrSvg)}`}
          alt="QR code"
          width={220}
          height={220}
          className="self-center rounded-2xl bg-white p-2"
        />
        {enableState.secret && (
          <code className="self-center rounded-lg bg-surface-muted px-3 py-1 text-sm break-all">
            {enableState.secret}
          </code>
        )}
        <form {...confirm} className="flex flex-col gap-3">
          {confirmState?.error && <Alert>{errorText(confirmState.error)}</Alert>}
          <Field
            label={t("fields.code")}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
          <Button type="submit" disabled={confirming}>
            {t("profile.confirm2fa")}
          </Button>
        </form>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t("profile.backupCodesTitle")}</h3>
          <p className="text-sm text-text-muted">{t("profile.backupCodesHint")}</p>
          <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-3 font-mono text-sm">
            {enableState.backupCodes?.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <form {...enable} className="flex flex-col gap-3">
      <p>{t("profile.twoFactorOff")}</p>
      {enableState?.error && <Alert>{errorText(enableState.error)}</Alert>}
      <Field label={t("fields.password")} name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={enabling}>
        {t("profile.enable2fa")}
      </Button>
    </form>
  );
}
