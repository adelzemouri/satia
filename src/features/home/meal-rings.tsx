import { getTranslations } from "next-intl/server";

import { MEAL_SLOTS, type MealSlot } from "@/db/schema";
import { SLOT_SHARES } from "@/domain/coach";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";
import { MiniRing } from "@/ui/mini-ring";

/**
 * Les quatre repas en anneaux : chacun se remplit vers sa part indicative de l'objectif du jour.
 * Toucher un repas vide ouvre l'ajout d'un aliment ; un repas déjà saisi ouvre son détail dans le journal.
 */
export async function MealRings({
  kcalBySlot,
  goalKcal,
  current,
  date,
}: {
  kcalBySlot: Record<MealSlot, number>;
  goalKcal: number | null;
  current: MealSlot;
  date: string;
}) {
  const t = await getTranslations();
  return (
    <ul className="grid grid-cols-4 gap-2">
      {MEAL_SLOTS.map((slot) => {
        const kcal = Math.round(kcalBySlot[slot]);
        const target = goalKcal ? Math.round(goalKcal * SLOT_SHARES[slot]) : 0;
        const percent = target > 0 ? (kcal / target) * 100 : 0;
        const filled = kcalBySlot[slot] > 0;
        const highlight = slot === current && !filled;
        const name = t(`slotsLower.${slot}`);
        return (
          <li key={slot} className="flex">
            <Link
              href={
                filled
                  ? { pathname: "/journal", query: { date }, hash: `slot-${slot}` }
                  : { pathname: "/add", query: { slot, date } }
              }
              aria-label={filled ? t("home.viewSlot", { slot, name }) : t("home.addTo", { slot, name })}
              className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center"
            >
              <MiniRing percent={percent} size={56} stroke={5}>
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${
                    highlight ? "bg-pomme text-on-pomme" : filled ? "bg-primary-soft text-primary" : "text-primary"
                  }`}
                >
                  <Icon name={filled ? "check" : "plus"} size={18} />
                </span>
              </MiniRing>
              <span className="text-xs leading-tight font-bold">{t(`slots.${slot}`)}</span>
              <span className="text-xs text-text-muted">
                {target > 0 ? t("home.slotKcal", { kcal, target }) : t("home.kcalValue", { value: kcal })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
