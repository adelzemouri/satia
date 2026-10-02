import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { logoutAction } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/server/session";

export async function AppHeader({ user }: { user: CurrentUser }) {
  const t = await getTranslations("nav");
  const linkClass = "flex min-h-12 items-center rounded-full px-3 font-semibold hover:bg-surface-muted";
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav aria-label={APP_NAME} className="mx-auto flex max-w-2xl items-center gap-1 px-3">
        <Link href="/" className="mr-auto flex min-h-12 items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
          <img src="/icons/icon.svg" alt="" width={32} height={32} />
          <span className="font-display text-lg font-semibold">{APP_NAME}</span>
        </Link>
        <Link href="/profile" className={linkClass}>
          {t("profile")}
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className={linkClass}>
            {t("admin")}
          </Link>
        )}
        <form action={logoutAction}>
          <button type="submit" className={linkClass}>
            {t("logout")}
          </button>
        </form>
      </nav>
    </header>
  );
}
