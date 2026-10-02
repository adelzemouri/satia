import { getTranslations, setRequestLocale } from "next-intl/server";

import { CustomFoodForm } from "@/features/foods/custom-food-form";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function NewFoodPage({ params }: PageProps<"/[locale]/foods/new">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations("foods");
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{t("newFood")}</h1>
      <Card>
        <CustomFoodForm />
      </Card>
    </>
  );
}
