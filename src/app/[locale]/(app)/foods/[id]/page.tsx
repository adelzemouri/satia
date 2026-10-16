import { notFound } from "next/navigation";
import { after } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { shortFoodName } from "@/domain/food-name";
import { COACH_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { parseDayParam } from "@/domain/day-param";
import { MEAL_SLOTS } from "@/domain/meals";
import { catalogRecipeFor } from "@/domain/recipes/catalog";
import { llmConfig } from "@/llm/config";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { DomainError } from "@/server/errors";
import { AskCoach } from "@/features/coach/ask-coach";
import { ProductThumb } from "@/features/foods/product-thumb";
import { QualityBadges } from "@/features/foods/quality-badges";
import { ZoomablePhoto } from "@/ui/photo-viewer";
import { RecipePhotoForm } from "@/features/foods/recipe-photo-form";
import { RecipeStepsButton } from "@/features/planning/recipe-steps-button";
import { RecipeVisual } from "@/features/recipes/recipe-visual";
import { aiAvailability } from "@/server/ai-availability";
import { importOpenFoodFactsProduct } from "@/server/open-food-facts";
import { type Food, getFoodDetails, isGeneratedRecipePhoto, recipeIngredients } from "@/server/foods";
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
  // Produit enregistré avant les marqueurs NOVA : relu sur OFF après l'affichage, prêt pour la prochaine fois.
  const offRef = food.source === "off" ? food.sourceRef : null;
  if (offRef && food.novaGroup === 4 && food.novaMarkers === null) {
    after(() => importOpenFoodFactsProduct(user.id, offRef).catch(() => undefined));
  }

  const portion = food.unitWeights?.portion ?? null;
  const catalog = food.source === "recipe" ? catalogRecipeFor(food.sourceRef) : undefined;
  const editableRecipe =
    food.source === "recipe" && (food.ownerUserId === user.id || food.householdId === user.householdId);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  // Recette du foyer ou personnelle : ses ingrédients et sa préparation, comme une fiche du catalogue.
  const ownRecipe = food.source === "recipe" && !catalog;
  // L'admin peut refaire par l'IA la photo de n'importe quelle recette, catalogue compris.
  const adminRecipe = food.source === "recipe" && user.role === "admin";
  const [ingredients, ai] = await Promise.all([
    ownRecipe ? recipeIngredients(user.id, food.id) : [],
    adminRecipe && llmConfig().imageModel ? aiAvailability() : null,
  ]);
  const canRegenerate = Boolean(ai?.available);
  // Photo rangée dans le stockage (prise par la famille ou refaite par l'IA), servie par URL signée.
  const storedPhoto = food.photoKey && food.imageUrl ? { key: food.photoKey, url: food.imageUrl } : null;
  const steps = food.recipeSteps ?? [];
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
      {catalog && (
        <figure className="-mx-4 flex flex-col gap-1 sm:mx-0">
          <div className="overflow-hidden sm:rounded-[var(--radius-card)]">
            <RecipeVisual
              recipe={catalog}
              imageUrl={food.imageUrl}
              sizes="(min-width: 640px) 640px, 100vw"
              priority
              morph
            />
          </div>
        </figure>
      )}
      {!catalog && storedPhoto && (
        <figure className="-mx-4 flex flex-col gap-1 sm:mx-0">
          <ZoomablePhoto
            photo={{ src: storedPhoto.url, alt: shortFoodName(food.nameFr) }}
            caption={shortFoodName(food.nameFr)}
            className="w-full overflow-hidden sm:rounded-[var(--radius-card)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- photo privée servie par URL signée */}
            <img src={storedPhoto.url} alt="" className="block aspect-[4/3] w-full object-cover" />
          </ZoomablePhoto>
          {!isGeneratedRecipePhoto(storedPhoto.key) && (
            <figcaption className="px-4 text-xs text-text-muted sm:px-0">{t("foods.photo.caption")}</figcaption>
          )}
        </figure>
      )}
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold text-text-muted">
            {catalog ? t("recipes.source") : t(`add.sources.${food.source}`)}
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{shortFoodName(food.nameFr)}</h1>
          {shortFoodName(food.nameFr) !== food.nameFr && <p className="text-text-muted">{food.nameFr}</p>}
          {food.brand && <p className="text-lg">{food.brand}</p>}
          {food.source === "off" && food.sourceRef && (
            <p className="text-sm text-text-muted">{t("product.barcode", { code: food.sourceRef })}</p>
          )}
        </div>
        {food.imageUrl && !catalog && !food.photoKey && (
          <ZoomablePhoto
            photo={{ src: food.imageUrl, alt: shortFoodName(food.nameFr) }}
            caption={shortFoodName(food.nameFr)}
            className="shrink-0 rounded-lg"
          >
            <ProductThumb src={food.imageUrl} size={112} />
          </ZoomablePhoto>
        )}
      </div>

      <Link
        href={{ pathname: "/add", query: { food: food.id, date, ...(slot && { slot }), ...(via && { via }) } }}
        className={buttonClass("primary")}
      >
        {t("product.add")}
      </Link>
      <AskCoach
        topic={{ kind: "food", id: food.id }}
        label={shortFoodName(food.nameFr)}
        coachName={COACH_NAME}
        className="self-start"
      />
      {(editableRecipe || canRegenerate) && (
        <RecipePhotoForm
          foodId={food.id}
          canUpload={editableRecipe}
          hasPhoto={Boolean(food.photoKey && !isGeneratedRecipePhoto(food.photoKey))}
          canRegenerate={canRegenerate}
        />
      )}
      {editableRecipe && (
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

      {catalog && (
        <>
          <ul className="flex flex-wrap gap-2" aria-label={catalog.name}>
            {[
              portion && t("recipes.portionKcal", { kcal: Math.round((food.kcal * portion) / 100) }),
              t("recipes.minutes", { minutes: catalog.minutes }),
              t("recipes.servings", { count: catalog.servings }),
              catalog.vegetarian && t("recipes.vegetarian"),
            ]
              .filter(Boolean)
              .map((label) => (
                <li key={String(label)} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold">
                  {label}
                </li>
              ))}
          </ul>
          <Card aria-labelledby="ingredients-title">
            <div className="flex flex-col">
              <h2 id="ingredients-title" className="text-xl font-bold">
                {t("recipes.ingredients")}
              </h2>
              <p className="text-sm text-text-muted">{t("recipes.ingredientsFor", { count: catalog.servings })}</p>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {catalog.ingredients.map(([code, grams, label], index) => (
                <li key={`${code}-${index}`} className="flex justify-between gap-3 py-2">
                  <span className="first-letter:uppercase">{label}</span>
                  <span className="shrink-0 text-text-muted">{number.format(grams)} g</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card aria-labelledby="steps-title">
            <h2 id="steps-title" className="text-xl font-bold">
              {t("recipes.steps")}
            </h2>
            <StepList steps={catalog.steps} />
          </Card>
        </>
      )}

      {ownRecipe && ingredients.length > 0 && (
        <>
          <Card aria-labelledby="ingredients-title">
            <div className="flex flex-col">
              <h2 id="ingredients-title" className="text-xl font-bold">
                {t("recipes.ingredients")}
              </h2>
              {food.servings && (
                <p className="text-sm text-text-muted">{t("recipes.ingredientsFor", { count: food.servings })}</p>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {ingredients.map((item, index) => (
                <li key={`${item.id}-${index}`} className="flex justify-between gap-3 py-2">
                  <span className="first-letter:uppercase">{item.name}</span>
                  <span className="shrink-0 text-text-muted">{number.format(item.grams)} g</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card aria-labelledby="steps-title">
            <h2 id="steps-title" className="text-xl font-bold">
              {t("recipes.steps")}
            </h2>
            {steps.length > 0 ? (
              <StepList steps={steps} />
            ) : (
              <>
                <p className="text-text-muted">{t("recipes.stepsEmpty")}</p>
                {ai?.available && <RecipeStepsButton recipeId={food.id} coachName={COACH_NAME} />}
              </>
            )}
          </Card>
        </>
      )}

      {(food.nutriscore || food.novaGroup) && (
        <QualityBadges
          nutriscore={food.nutriscore}
          novaGroup={food.novaGroup}
          novaMarkers={food.novaMarkers}
          fiberG={food.fiberG}
          sugarsG={food.sugarsG}
          saltG={food.saltG}
        />
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
        ) : food.source === "ciqual" || catalog ? (
          t("add.ciqualAttribution")
        ) : null}
      </p>
    </>
  );
}

/** Étapes numérotées d'une préparation. */
function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
          >
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
