import { AppHeader } from "@/features/navigation/app-header";
import { BottomNav } from "@/features/navigation/bottom-nav";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const user = await requireUser(toLocale((await params).locale));
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
