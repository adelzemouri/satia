import { getTranslations } from "next-intl/server";

import { COACH_NAME } from "@/config/app";
import type { CoachQuestion } from "@/domain/coach-questions";
import { CoachAvatar } from "@/features/coach/coach-avatar";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";

/** Carte du coach sur l'accueil : son prénom et trois questions prêtes à poser. */
export async function CoachCard({ questions }: { questions: CoachQuestion[] }) {
  const t = await getTranslations("coach");
  return (
    <section
      aria-labelledby="coach-card-title"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <CoachAvatar size={44} />
        <div className="flex min-w-0 flex-col">
          <h2 id="coach-card-title" className="text-lg font-bold">
            {t("cardTitle", { name: COACH_NAME })}
          </h2>
          <p className="text-sm text-text-muted">{t("cardHint")}</p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <li key={question}>
            <Link
              href={{ pathname: "/coach", query: { ask: question } }}
              className="flex min-h-11 items-center rounded-full bg-surface-muted px-4 py-2 text-sm font-semibold"
            >
              {t(`questions.${question}`)}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/coach"
            className="flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-primary"
          >
            {t("cardOpen", { name: COACH_NAME })}
            <Icon name="right" size={16} />
          </Link>
        </li>
      </ul>
    </section>
  );
}
