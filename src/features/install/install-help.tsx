"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";

import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";

import { useInstallPrompt } from "./install-prompt";
import { detectPlatform, INSTALL_PATH, type InstallPlatform } from "./platform";

const noSubscribe = () => () => {};

/** Appareil détecté côté navigateur ; `null` au rendu serveur. */
export function useDetectedPlatform(): InstallPlatform | null {
  return useSyncExternalStore(
    noSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5 rounded-2xl bg-bg p-3.5">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-on-primary"
      >
        {number}
      </span>
      <span className="pt-1 leading-snug">{children}</span>
    </li>
  );
}

/** Icône de Safari glissée dans la phrase, nommée pour les lecteurs d'écran. */
function InlineIcon({ name, label }: { name: "share" | "addSquare"; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex align-[-4px] text-primary">
      <Icon name={name} size={20} />
    </span>
  );
}

function IosSteps() {
  const t = useTranslations("install.ios");
  return (
    <>
      <ol aria-label={t("label")} className="flex flex-col gap-3">
        <Step number={1}>
          {t.rich("share", { b: strong, icon: () => <InlineIcon name="share" label={t("shareIcon")} /> })}
        </Step>
        <Step number={2}>
          {t.rich("add", { b: strong, icon: () => <InlineIcon name="addSquare" label={t("addIcon")} /> })}
        </Step>
        <Step number={3}>{t.rich("confirm", { b: strong })}</Step>
      </ol>
      <p className="text-sm text-text-muted">{t("chrome")}</p>
    </>
  );
}

function AndroidSteps() {
  const t = useTranslations("install.android");
  const install = useInstallPrompt();
  const toast = useToast();
  return (
    <>
      {install && (
        <div className="flex flex-col gap-2">
          <Button
            onClick={async () => {
              if (await install()) toast({ message: t("installed") });
            }}
          >
            <Icon name="download" />
            {t("button")}
          </Button>
          <p className="text-center text-sm text-text-muted">{t("buttonHint")}</p>
        </div>
      )}
      <section className={`flex flex-col gap-3 ${install ? "border-t border-border pt-4" : ""}`}>
        <h3 className="font-bold">{install ? t("fallbackTitle") : t("manualTitle")}</h3>
        <ol aria-label={t("label")} className="flex flex-col gap-3">
          <Step number={1}>{t.rich("menu", { b: strong })}</Step>
          <Step number={2}>{t.rich("add", { b: strong })}</Step>
        </ol>
        <p className="text-sm text-text-muted">{t("samsung")}</p>
      </section>
    </>
  );
}

function DesktopHelp() {
  const t = useTranslations("install.desktop");
  const install = useInstallPrompt();
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void import("qrcode").then(async ({ default: QRCode }) => {
      const svg = await QRCode.toString(`${window.location.origin}${INSTALL_PATH}`, {
        type: "svg",
        margin: 1,
        color: { dark: "#111816", light: "#ffffff" },
      });
      if (alive) setQr(svg);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR code SVG généré dans le navigateur
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}
            alt={t("qr")}
            width={156}
            height={156}
            className="shrink-0 rounded-2xl border border-border bg-white p-2"
          />
        ) : (
          <span aria-hidden="true" className="size-[156px] shrink-0 rounded-2xl bg-surface-muted" />
        )}
        <p className="leading-relaxed">{t("scan")}</p>
      </div>
      {install && (
        <section className="flex flex-col gap-2.5 border-t border-border pt-4">
          <h3 className="font-bold">{t("computerTitle")}</h3>
          <p className="text-sm text-text-muted">{t("computerHint")}</p>
          <button
            type="button"
            onClick={async () => {
              if (await install()) toast({ message: t("installed") });
            }}
            className={buttonClass("secondary", "self-start border-2 border-primary text-primary")}
          >
            <Icon name="download" />
            {t("computerButton")}
          </button>
        </section>
      )}
    </>
  );
}

/**
 * Les gestes pour ouvrir Pommelia comme une app, selon l'appareil. Sur téléphone, un lien
 * bascule entre iPhone et Android si la détection s'est trompée.
 */
export function InstallHelp({ platform }: { platform: InstallPlatform }) {
  const t = useTranslations("install");
  const [shown, setShown] = useState<InstallPlatform>(platform);
  if (shown === "desktop") return <DesktopHelp />;
  return (
    <>
      {shown === "ios" ? <IosSteps /> : <AndroidSteps />}
      <button
        type="button"
        onClick={() => setShown(shown === "ios" ? "android" : "ios")}
        className="min-h-11 self-center px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {shown === "ios" ? t("switchToAndroid") : t("switchToIos")}
      </button>
    </>
  );
}
