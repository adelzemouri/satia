import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS } from "@/domain/meals";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { DomainError } from "@/server/errors";
import { ProductThumb } from "@/features/foods/product-thumb";
import { type Food, getFoodDetails } from "@/server/foods";
import { requireUser } from "@/server/session";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatDay } from "@/ui/format-date";

async function loadFood(userId: string, id: string): Promise<Food> {
  try {
    return await getFoodDetails(userId, id);
  } catch (error) {
    if (error instanceof DomainError || (error instanceof Error && error.name === "ZodError")) notFound();
    throw error;
  }
}

export default async function FoodPage({ params, searchParams }: PageProps<"/[locale]/foods/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const food = await loadFood(user.id, id);
  const query = await searchParams;
  const date = parseDayParam(query.date, todayIso());
  const slot = MEAL_SLOTS.find((value) => value === query.slot);
  const via = query.via === "barcode" ? "barcode" : undefined;
  const t = await getTranslations();

  const portion = food.unitWeights?.portion ?? null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const rows: { label: string; value: number | null; unit: string; indent?: boolean }[] = [
    { label: t("product.energy"), value: food.kcal, unit: "kcal" },
    { label: t("product.fat"), value: food.fatG, unit: "g" },
    { label: t("product.carbs"), value: food.carbsG, unit: "g" },
    { label: t("product.sugars"), value: food.sugarsG, unit: "g", indent: true },
    { label: t("product.fiber"), value: food.fiberG, unit: "g" },
    { label: t("product.protein"), value: food.proteinG, unit: "g" },
    { label: t("product.salt"), value: food.saltG, unit: "g" },
  ];
  const cell = (value: number | null, factor: number, unit: string) =>
    value === null ? t("product.unknown") : `${number.format(value * factor)} ${unit}`;

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold text-text-muted">
            {t(food.householdId ? "add.sources.family" : `add.sources.${food.source}`)}
          </p>
          <h1 className="font-display text-3xl font-semibold">{food.nameFr}</h1>
          {food.brand && <p className="text-lg">{food.brand}</p>}
          {food.source === "off" && food.sourceRef && (
            <p className="text-sm text-text-muted">{t("product.barcode", { code: food.sourceRef })}</p>
          )}
        </div>
        {food.imageUrl && <ProductThumb src={food.imageUrl} size={112} />}
      </div>

      <Link
        href={{ pathname: "/add", query: { food: food.id, date, ...(slot && { slot }), ...(via && { via }) } }}
        className={buttonClass("primary")}
      >
        {t("product.add")}
      </Link>
      {food.source === "recipe" && (food.ownerUserId === user.id || food.householdId === user.householdId) && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/foods/${food.id}/edit`} className={buttonClass("secondary")}>
            {t("foods.editRecipe")}
          </Link>
          <Link
            href={{ pathname: "/family/share", query: { food: food.id, date, ...(slot && { slot }) } }}
            className={buttonClass("secondary")}
          >
            {t("add.shareWithFamily")}
          </Link>
        </div>
      )}

      {(food.nutriscore || food.novaGroup) && (
        <ul className="flex flex-wrap gap-2" aria-label={t("quality.labels")}>
          {food.nutriscore && (
            <li className="rounded-full border border-border bg-surface-muted px-4 py-2 font-semibold">
              {t("quality.nutriscore", { grade: food.nutriscore.toUpperCase() })}
            </li>
          )}
          {food.novaGroup && (
            <li className="rounded-full border border-border bg-surface-muted px-4 py-2 font-semibold">
              {t("quality.nova", { group: food.novaGroup })}
            </li>
          )}
        </ul>
      )}

      <Card aria-labelledby="nutrients">
        <h2 id="nutrients" className="text-xl font-semibold">
          {t("product.nutrients")}
        </h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-sm text-text-muted">
              <th scope="col" className="py-2 font-semibold">
                <span className="sr-only">{t("product.nutrients")}</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                {t("product.per100")}
              </th>
              {portion && (
                <th scope="col" className="py-2 pl-3 text-right font-semibold">
                  {t("product.perPortion", { grams: portion })}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th scope="row" className={`py-2 font-normal ${row.indent ? "pl-4 text-text-muted" : ""}`}>
                  {row.label}
                </th>
                <td className="py-2 pl-3 text-right">{cell(row.value, 1, row.unit)}</td>
                {portion && <td className="py-2 pl-3 text-right">{cell(row.value, portion / 100, row.unit)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-sm text-text-muted">
        {food.source === "off" ? (
          <>
            <a
              href={`https://world.openfoodfacts.org/product/${food.sourceRef}`}
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              {t("add.offAttribution")}
            </a>
            {food.fetchedAt &&
              ` ${t("product.updated", { date: formatDay(food.fetchedAt.toISOString().slice(0, 10), locale, "short") })}`}
          </>
        ) : food.source === "ciqual" ? (
          t("add.ciqualAttribution")
        ) : null}
      </p>
    </>
  );
}
