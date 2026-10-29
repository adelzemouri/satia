import { getTranslations } from "next-intl/server";

import { RouteMemory } from "@/features/feedback/route-memory";
import { InstallHost } from "@/features/install/install-host";
import { BackButton } from "@/features/navigation/back-button";
import { BottomNav } from "@/features/navigation/bottom-nav";
import { SideNav } from "@/features/navigation/side-nav";
import { OfflineProvider, OfflineStatus } from "@/features/offline/offline-provider";
import { toLocale } from "@/i18n/routing";
import { llmConfig } from "@/llm/config";
import { requireUser } from "@/server/session";
import { FillsGate } from "@/ui/fills-gate";
import { ToastProvider } from "@/ui/toast";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const user = await requireUser(toLocale((await params).locale));
  const t = await getTranslations("nav");
  return (
    <OfflineProvider userId={user.id}>
      <ToastProvider>
        <FillsGate />
        <RouteMemory />
        {/* Premier arrêt au clavier : passer directement au contenu de la page. */}
        <a
          href="#contenu"
          className="sr-only z-20 rounded-full bg-surface px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {t("skipToContent")}
        </a>
        {/* Sur ordinateur, la barre latérale occupe la gauche ; les pages qui portent data-wide
            (accueil, recettes, progrès) s'étalent, les formulaires gardent une colonne lisible. */}
        <div className="lg:pl-20 xl:pl-64">
          <main
            id="contenu"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12 lg:has-[[data-wide]]:max-w-6xl"
          >
            <OfflineStatus userId={user.id} />
            <BackButton />
            {children}
          </main>
        </div>
        <SideNav />
        <InstallHost />
        <BottomNav ai={llmConfig().provider !== "none"} />
      </ToastProvider>
    </OfflineProvider>
  );
}
