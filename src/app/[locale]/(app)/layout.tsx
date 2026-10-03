import { getTranslations } from "next-intl/server";

import { BottomNav } from "@/features/navigation/bottom-nav";
import { OfflineProvider, OfflineStatus } from "@/features/offline/offline-provider";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const user = await requireUser(toLocale((await params).locale));
  const t = await getTranslations("nav");
  return (
    <OfflineProvider userId={user.id}>
      {/* Premier arrêt au clavier : passer directement au contenu de la page. */}
      <a
        href="#contenu"
        className="sr-only z-20 rounded-full bg-surface px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>
      <main
        id="contenu"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]"
      >
        <OfflineStatus userId={user.id} />
        {children}
      </main>
      <BottomNav />
    </OfflineProvider>
  );
}
