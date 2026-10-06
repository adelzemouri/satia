"use client";

import { useEffect } from "react";

/**
 * Amène à l'ancre de l'URL une fois la page affichée : lors d'une navigation côté client,
 * l'ancre est cherchée pendant le squelette de chargement, avant que la section n'existe.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
