"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { personalizeProgramAction } from "./actions";

/**
 * Demande au coach ses titres et conseils pour la semaine après l'affichage (un appel au
 * plus par semaine) ; la page se met à jour quand c'est prêt. Sans IA, rien ne change.
 */
export function PersonalizeLoader() {
  const t = useTranslations("training.home");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      await personalizeProgramAction();
      setDone(true);
      router.refresh();
    });
  }, [router]);

  if (done && !pending) return null;
  return (
    <p role="status" className="text-sm text-text-muted">
      {t("personalizing")}
    </p>
  );
}
