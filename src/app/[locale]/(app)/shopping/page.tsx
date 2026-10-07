import { getTranslations, setRequestLocale } from "next-intl/server";

import { todayIso } from "@/domain/dates";
import { isoWeekStart } from "@/domain/streak";
import { AutoRefresh } from "@/features/planning/auto-refresh";
import { AddShoppingItemForm, ShoppingList } from "@/features/planning/shopping-list";
import { toLocale } from "@/i18n/routing";
import { listShopping } from "@/server/planning";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { Columns } from "@/ui/columns";

export default async function ShoppingPage({ params }: PageProps<"/[locale]/shopping">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const items = await listShopping(user.householdId);
  const t = await getTranslations("shopping");

  return (
    <Columns>
      <AutoRefresh />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-text-muted">{t("intro")}</p>
      <Card aria-label={t("title")}>
        <ShoppingList
          weekStart={isoWeekStart(todayIso())}
          items={items.map(({ id, label, grams, note, aisle, checked }) => ({
            id,
            label,
            grams,
            note,
            aisle,
            checked,
          }))}
        />
      </Card>
      <Card aria-labelledby="add-item">
        <h2 id="add-item" className="text-xl font-semibold">
          {t("addTitle")}
        </h2>
        <AddShoppingItemForm />
      </Card>
    </Columns>
  );
}
