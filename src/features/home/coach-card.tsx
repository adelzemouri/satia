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
      className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <CoachAvatar size={52} />
        <div className="flex min-w-0 flex-col">
          <h2 id="coach-card-title" className="text-lg font-bold">
            {t("cardTitle", { name: COACH_NAME })}
          </h2>
          <p className="text-sm text-text-muted">{t("cardHint")}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li key={question}>
            <Link
              href={{ pathname: "/coach", query: { ask: question } }}
              className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-2.5 font-semibold"
            >
              <span>{t(`questions.${question}`)}</span>
              <span className="shrink-0 text-primary">
                <Icon name="right" size={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/coach" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
        {t("cardOpen", { name: COACH_NAME })}
      </Link>
    </section>
  );
}
