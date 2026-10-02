import type { ReactNode } from "react";

import { APP_NAME } from "@/config/app";

/** Mise en page mobile-first d'un écran simple (connexion, installation…). */
export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
        <img src="/icons/icon.svg" alt="" width={40} height={40} />
        <span className="font-display text-xl font-semibold">{APP_NAME}</span>
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {intro && <p className="text-text-muted">{intro}</p>}
      </header>
      {children}
    </main>
  );
}
