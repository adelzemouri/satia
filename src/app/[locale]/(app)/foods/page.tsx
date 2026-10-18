import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeleteFoodButton } from "@/features/foods/delete-food-button";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { ownFoods } from "@/server/foods";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";

export default async function FoodsPage({ params }: PageProps<"/[locale]/foods">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const foods = await ownFoods(user.id);
  const t = await getTranslations();

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("foods.title")}</h1>
      <div className="flex flex-wrap gap-3">
        <Link href="/foods/new" className={buttonClass("primary")}>
          {t("foods.newFood")}
        </Link>
      </div>
      <Card>
        {foods.length === 0 ? (
          <EmptyState scene="jar">{t("foods.empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {foods.map((food) => (
              <li key={food.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/foods/${food.id}`}
                    className="truncate font-semibold underline-offset-4 hover:underline"
                  >
                    {food.nameFr}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {t(`add.sources.${food.source}`)} · {t("add.per100", { kcal: Math.round(food.kcal) })}
                  </span>
                </span>
                <DeleteFoodButton id={food.id} name={food.nameFr} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-sm text-text-muted">
        {t("foods.recipesHint")}{" "}
        <Link href="/recipes" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("foods.recipesLink")}
        </Link>
      </p>
    </>
  );
}
