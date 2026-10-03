"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";

import { isTabRoot, parentPath } from "./parent-path";

/** Une page précédente de l'app existe-t-elle dans l'historique (Navigation API) ? */
function canGoBackInApp(): boolean {
  const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  return navigation?.canGoBack === true;
}

/**
 * Bouton « Retour » des pages secondaires. Il revient à la page précédente quand on est arrivé
 * depuis l'app (on retrouve ainsi le défilement et les filtres), sinon il ouvre la page parente :
 * indispensable dans l'app installée sur iPhone, qui n'a pas de bouton retour.
 */
export function BackButton() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  if (isTabRoot(pathname)) return null;

  return (
    <Link
      href={parentPath(pathname)}
      onClick={(event) => {
        if (!canGoBackInApp()) return;
        event.preventDefault();
        router.back();
      }}
      className="-mb-3 -ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 font-semibold text-primary hover:bg-primary-soft"
    >
      <Icon name="left" size={20} />
      {t("back")}
    </Link>
  );
}
