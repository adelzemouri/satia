import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { DishThumb } from "./dish-thumb";

/** Vignette d'une recette de la famille, au même format que celles du catalogue. */
export function HouseholdRecipeCard({
  id,
  name,
  imageUrl,
  portionKcal,
  servings,
}: {
  id: string;
  name: string;
  imageUrl: string | null;
  portionKcal: number;
  servings: number;
}) {
  const t = useTranslations("recipes");
  return (
    <Link
      href={`/foods/${id}`}
      className="flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface"
    >
      <DishThumb imageUrl={imageUrl} sizes="(min-width: 640px) 33vw, 50vw" />
      <span className="flex flex-col gap-0.5 px-3 py-2">
        <span className="leading-snug font-bold">{name}</span>
        <span className="text-sm text-text-muted">{t("perServing", { kcal: portionKcal, count: servings })}</span>
      </span>
    </Link>
  );
}
