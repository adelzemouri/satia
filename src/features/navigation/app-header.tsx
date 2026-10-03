import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { LogoutForm } from "@/features/offline/logout-form";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/server/session";
import { Icon } from "@/ui/icon";

export async function AppHeader({ user }: { user: CurrentUser }) {
  const t = await getTranslations("nav");
  // Sur téléphone, seules les icônes s'affichent (le libellé reste lu par les lecteurs d'écran).
  const linkClass =
    "flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full px-3 font-semibold whitespace-nowrap hover:bg-surface-muted";
  const labelClass = "sr-only sm:not-sr-only";
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-1 px-3">
        <Link href="/" className="mr-auto flex min-h-12 min-w-0 items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
          <img src="/icons/icon.svg" alt="" width={32} height={32} />
          <span className="truncate font-display text-lg font-semibold">{APP_NAME}</span>
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className={linkClass}>
            <Icon name="admin" />
            <span className={labelClass}>{t("admin")}</span>
          </Link>
        )}
        <LogoutForm>
          <button type="submit" className={linkClass}>
            <Icon name="logout" />
            <span className={labelClass}>{t("logout")}</span>
          </button>
        </LogoutForm>
      </div>
    </header>
  );
}
