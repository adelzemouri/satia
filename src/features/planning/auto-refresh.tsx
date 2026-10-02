"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Relit la page à intervalle régulier tant qu'elle est visible : ce qu'un autre membre du
 * foyer ajoute ou coche apparaît sans recharger (l'hébergement sans serveur permanent ne
 * permet pas de connexion ouverte en continu).
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
