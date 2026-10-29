"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { buttonClass } from "@/ui/button";

import { InstallHelp, useDetectedPlatform } from "./install-help";
import { isStandalone } from "./platform";

/**
 * Dernier écran de l'inscription, vu une seule fois : comment garder Pommelia sur l'écran
 * d'accueil. Déjà ouverte depuis son icône, on passe directement à l'accueil.
 */
export function InstallWelcome() {
  const t = useTranslations("install.welcome");
  const router = useRouter();
  const platform = useDetectedPlatform();

  useEffect(() => {
    if (isStandalone()) router.replace("/");
  }, [router]);

  const desktop = platform === "desktop";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
        <img src="/icons/icon.svg" alt="" width={80} height={80} className="rounded-[1.4rem]" />
        <p className="font-bold text-primary">{t("ready")}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance">
          {desktop ? t("titleDesktop") : t("title")}
        </h1>
        <p className="text-text-muted">{desktop ? t("introDesktop") : t("intro")}</p>
      </header>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4">
        {platform ? (
          <InstallHelp platform={platform} />
        ) : (
          <div aria-hidden="true" className="h-48 animate-pulse rounded-2xl bg-surface-muted" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Link href="/" className={buttonClass("primary", "w-full")}>
          {t("go")}
        </Link>
        <p className="text-center text-sm text-text-muted">{t("later")}</p>
      </div>
    </div>
  );
}
