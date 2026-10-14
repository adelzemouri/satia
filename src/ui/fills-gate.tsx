"use client";

import { useEffect } from "react";

/** Durée du remplissage des anneaux et jauges à l'ouverture (globals.css), plus une marge. */
const FILL_MS = 700;

/**
 * Les anneaux et jauges se remplissent une fois, à l'ouverture de l'app. Ensuite, revenir sur une
 * page les montre directement à leur valeur : on les voit des dizaines de fois par jour.
 */
export function FillsGate() {
  useEffect(() => {
    const timer = window.setTimeout(() => document.documentElement.setAttribute("data-fills-done", ""), FILL_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
