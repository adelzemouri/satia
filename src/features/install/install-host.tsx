"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";

import { InstallHelp, useDetectedPlatform } from "./install-help";
import { INSTALL_HASH } from "./platform";

/**
 * Fiche « Installer sur l'écran d'accueil ». Comme la fiche des remarques, elle s'ouvre sans
 * navigation en interceptant les liens vers `#installer`, et aussi à l'arrivée sur une page avec
 * cette ancre : c'est l'adresse du QR code affiché sur ordinateur.
 */
export function InstallHost() {
  const t = useTranslations("install");
  const platform = useDetectedPlatform();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Ouverture à l'arrivée depuis le QR code, ou si l'ancre change sans recharger la page.
    const fromHash = () => {
      if (window.location.hash === `#${INSTALL_HASH}`) setOpen(true);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href$="#${INSTALL_HASH}"]`);
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!platform) return null;
  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={platform === "desktop" ? t("titleDesktop") : t("title")}
      closeLabel={t("close")}
    >
      {platform !== "desktop" && <p className="text-text-muted">{t("intro")}</p>}
      <InstallHelp platform={platform} />
      {platform !== "desktop" && <Button onClick={() => setOpen(false)}>{t("done")}</Button>}
    </Sheet>
  );
}
