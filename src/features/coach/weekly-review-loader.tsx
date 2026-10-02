"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { ensureWeeklyReviewAction } from "./actions";

/**
 * Demande la rédaction du bilan de la semaine écoulée après l'affichage de la page, pour ne
 * pas la ralentir ; la page se met à jour quand le bilan est prêt.
 */
export function WeeklyReviewLoader() {
  const t = useTranslations("coach");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      await ensureWeeklyReviewAction();
      setDone(true);
    });
  }, []);

  if (done && !pending) return <p className="text-text-muted">{t("reviewEmpty")}</p>;
  return (
    <p role="status" className="text-text-muted">
      {t("reviewLoading")}
    </p>
  );
}
