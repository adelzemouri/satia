import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExpressionForm, RemoveButton } from "@/features/ai/personal-forms";
import { toLocale } from "@/i18n/routing";
import { listExpressions } from "@/server/personal";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function DictionaryPage({ params }: PageProps<"/[locale]/dictionary">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const expressions = await listExpressions(user.id);
  const t = await getTranslations();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("personal.dictionaryTitle")}</h1>
      <p className="text-text-muted">{t("personal.dictionaryIntro")}</p>
      <Card>
        {expressions.length === 0 ? (
          <p className="text-text-muted">{t("personal.noExpressions")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {expressions.map((expression) => (
              <li key={expression.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">« {expression.phrase} »</span>
                  <span className="text-sm text-text-muted">
                    {expression.foodName} · {expression.quantity} {t(`units.${expression.unit}`)}
                  </span>
                </span>
                <RemoveButton kind="expression" id={expression.id} name={expression.phrase} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <ExpressionForm />
      </Card>
    </>
  );
}
