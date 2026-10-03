"use client";

import { useTranslations } from "next-intl";

import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { useRouter } from "@/i18n/navigation";

/** Choix du repas en haut de l'écran d'ajout : il suit l'heure, mais se change d'un geste. */
export function SlotSelect({ date, slot }: { date: string; slot: MealSlot }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className="relative flex shrink-0 items-center">
      <select
        aria-label={t("add.slotLabel")}
        value={slot}
        onChange={(event) => router.replace({ pathname: "/add", query: { date, slot: event.target.value } })}
        className="min-h-12 appearance-none rounded-full border border-border bg-surface py-2 pr-10 pl-4 font-bold"
      >
        {MEAL_SLOTS.map((value) => (
          <option key={value} value={value}>
            {t(`slots.${value}`)}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-4"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
