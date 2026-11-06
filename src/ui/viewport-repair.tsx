"use client";

import { useEffect } from "react";

import { opensKeyboard, viewportLooksStuck } from "./viewport-stuck";

/**
 * Remet la barre du bas à sa place quand iOS oublie que le clavier s'est refermé
 * (voir viewport-stuck.ts). Un défilement d'un pixel aller-retour suffit à WebKit pour
 * recalculer la zone visible ; c'est invisible pour la personne.
 *
 * On vérifie peu après chaque fermeture du clavier, chaque changement de taille de la zone
 * visible, chaque fin de défilement et chaque retour dans l'appli.
 */
export function ViewportRepair() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let timer: number | undefined;
    // Si le coup de pouce ne suffit pas, on n'insiste pas en boucle : nos propres
    // défilements relanceraient la vérification. Une nouvelle fermeture du clavier réarme.
    let attempts = 0;

    const repair = () => {
      const stuck = viewportLooksStuck({
        offsetTop: vv.offsetTop,
        height: vv.height,
        innerHeight: window.innerHeight,
        scale: vv.scale,
        typing: opensKeyboard(document.activeElement),
      });
      if (!stuck) {
        attempts = 0;
        return;
      }
      if (attempts >= 2) return;
      attempts += 1;
      const { scrollX: x, scrollY: y } = window;
      // En bas de page, +1 ne bougerait rien : on part dans l'autre sens.
      window.scrollTo(x, y > 0 ? y - 1 : y + 1);
      window.scrollTo(x, y);
    };

    // Le clavier met ~250 ms à se refermer ; on attend aussi la fin d'un défilement
    // pour ne jamais couper l'élan du doigt.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(repair, 300);
    };
    const rearm = () => {
      attempts = 0;
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") rearm();
    };

    document.addEventListener("focusout", rearm);
    document.addEventListener("visibilitychange", onVisible);
    vv.addEventListener("resize", rearm);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", rearm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusout", rearm);
      document.removeEventListener("visibilitychange", onVisible);
      vv.removeEventListener("resize", rearm);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", rearm);
    };
  }, []);
  return null;
}
