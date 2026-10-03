"use client";

import type { ReactNode } from "react";

import { logoutAction } from "@/features/auth/actions";

import { postToWorker } from "./service-worker";

/** Déconnexion : les pages gardées pour le hors-ligne sont effacées de ce téléphone. */
export function LogoutForm({ children }: { children: ReactNode }) {
  return (
    <form action={logoutAction} onSubmit={() => postToWorker({ type: "clear-pages" })} className="shrink-0">
      {children}
    </form>
  );
}
