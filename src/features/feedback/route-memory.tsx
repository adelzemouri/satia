"use client";

import { useEffect } from "react";

import { usePathname } from "@/i18n/navigation";

const KEY = "pommelia.pages";

type Pages = { current: string | null; previous: string | null };

function read(): Pages {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Pages> | null;
    return { current: value?.current ?? null, previous: value?.previous ?? null };
  } catch {
    return { current: null, previous: null };
  }
}

/** Retient la page précédente, pour joindre à une remarque la page d'où l'on vient. */
export function RouteMemory() {
  const pathname = usePathname();
  useEffect(() => {
    const pages = read();
    if (pages.current === pathname) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ current: pathname, previous: pages.current }));
    } catch {
      // Stockage indisponible (navigation privée) : la page jointe sera simplement Moi.
    }
  }, [pathname]);
  return null;
}

/** Page à joindre : celle d'avant si l'on écrit depuis Moi, sinon la page affichée. */
export function feedbackPage(pathname: string): string {
  if (!pathname.startsWith("/profile")) return pathname;
  const { current, previous } = read();
  return (current === pathname ? previous : current) ?? pathname;
}
