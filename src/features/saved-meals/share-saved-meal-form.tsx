"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { shareSavedMealAction } from "@/features/family/actions";
import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { useToast } from "@/ui/toast";

const inputClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Choix des membres et du repas de la journée, puis envoi « à valider ». */
export function ShareSavedMealForm({
  id,
  summary,
  date,
  slot: initialSlot,
  members,
}: {
  id: string;
  summary: string;
  date: string;
  slot: MealSlot;
  members: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [memberIds, setMemberIds] = useState<string[]>(() => members.map((member) => member.id));
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [day, setDay] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (members.length === 0) return <p className="text-text-muted">{t("savedMeals.shareAlone")}</p>;

  const share = () =>
    startTransition(async () => {
      setError(null);
      const result = await shareSavedMealAction({ id, date: day, slot, memberIds });
      if (result?.error) setError(result.error);
      else {
        toast({ message: t("savedMeals.shared") });
        router.push("/meals");
      }
    });

  return (
    <form action={share} className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{summary}</p>
      {error && <Alert>{errorText(error)}</Alert>}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">{t("family.who")}</legend>
        {members.map((member) => (
          <label key={member.id} className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              checked={memberIds.includes(member.id)}
              onChange={(event) =>
                setMemberIds((list) =>
                  event.target.checked ? [...list, member.id] : list.filter((value) => value !== member.id),
                )
              }
              className="size-5 accent-primary"
            />
            {member.name}
          </label>
        ))}
        <p className="text-sm text-text-muted">{t("family.whoHint")}</p>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("savedMeals.shareDay")}</span>
          <input
            type="date"
            value={day}
            max={date}
            onChange={(event) => setDay(event.target.value || date)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("journal.slot")}</span>
          <select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot)} className={inputClass}>
            {MEAL_SLOTS.map((value) => (
              <option key={value} value={value}>
                {t(`slots.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" disabled={pending || memberIds.length === 0}>
        {t("family.share")}
      </Button>
    </form>
  );
}
