"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { FOCUSES } from "@/domain/training/types";
import { getPathname } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { buttonClass } from "@/ui/button";
import { Sheet } from "@/ui/sheet";

import { OtherRow } from "./other-row";

const chipClass =
  "flex min-h-11 cursor-pointer items-center rounded-full border-2 border-border bg-surface px-4 font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]";

/** Ligne « À la demande » : ouvre un panneau où l'on choisit la durée et le type, en pastilles. */
export function OnDemandRow() {
  const t = useTranslations("training");
  const locale = toLocale(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <OtherRow
        icon="sliders"
        title={t("home.onDemandTitle")}
        hint={t("home.onDemandHint")}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={t("home.onDemand")} closeLabel={t("home.close")}>
        <form action={getPathname({ href: "/training/session", locale })} method="get" className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">{t("home.duration")}</legend>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30, 45, 60].map((minutes) => (
                <label key={minutes} className={chipClass}>
                  <input
                    type="radio"
                    name="minutes"
                    value={minutes}
                    defaultChecked={minutes === 20}
                    className="sr-only"
                  />
                  {t("minutes", { count: minutes })}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">{t("home.type")}</legend>
            <div className="flex flex-wrap gap-2">
              {FOCUSES.map((focus) => (
                <label key={focus} className={chipClass}>
                  <input
                    type="radio"
                    name="focus"
                    value={focus}
                    defaultChecked={focus === "full_body"}
                    className="sr-only"
                  />
                  {t(`focus.${focus}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" name="noEquipment" value="1" className="size-5 accent-[var(--color-primary)]" />
            {t("home.noEquipment")}
          </label>
          <button type="submit" className={buttonClass("primary")}>
            {t("home.prepare")}
          </button>
        </form>
      </Sheet>
    </>
  );
}
