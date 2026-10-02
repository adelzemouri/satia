import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { logoutAction } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/server/session";

export async function AppHeader({ user }: { user: CurrentUser }) {
  const t = await getTranslations("nav");
  // Sur téléphone, seules les icônes s'affichent (le libellé reste lu par les lecteurs d'écran).
  const linkClass =
    "flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full px-3 font-semibold whitespace-nowrap hover:bg-surface-muted";
  const labelClass = "sr-only sm:not-sr-only";
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav aria-label={APP_NAME} className="mx-auto flex max-w-2xl items-center gap-1 px-3">
        <Link href="/" className="mr-auto flex min-h-12 min-w-0 items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
          <img src="/icons/icon.svg" alt="" width={32} height={32} />
          <span className="truncate font-display text-lg font-semibold">{APP_NAME}</span>
        </Link>
        <Link href="/profile" className={linkClass}>
          <Icon path={PROFILE_ICON} />
          <span className={labelClass}>{t("profile")}</span>
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className={linkClass}>
            <Icon path={ADMIN_ICON} />
            <span className={labelClass}>{t("admin")}</span>
          </Link>
        )}
        <form action={logoutAction} className="shrink-0">
          <button type="submit" className={linkClass}>
            <Icon path={LOGOUT_ICON} />
            <span className={labelClass}>{t("logout")}</span>
          </button>
        </form>
      </nav>
    </header>
  );
}

const PROFILE_ICON = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0";
const ADMIN_ICON = "M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4";
const LOGOUT_ICON = "M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 16l4-4-4-4M18 12H8";

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
