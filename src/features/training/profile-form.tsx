"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { useRouter } from "@/i18n/navigation";
import {
  HOME_EQUIPMENT,
  type Place,
  PLACES,
  SESSION_MINUTES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  type TrainingProfile,
  ZONES,
} from "@/domain/training/types";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { OptionList } from "@/ui/option-list";

import { saveTrainingProfileAction } from "./actions";

const chipClass =
  "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface px-4 font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]";

type Draft = Omit<TrainingProfile, "excluded">;

const DEFAULT: Draft = {
  level: "beginner",
  goal: "strength",
  place: "home_none",
  equipment: [],
  days: [0, 2, 4],
  minutes: 30,
  avoidZones: [],
};

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Cases à cocher en pastilles (choix multiples). */
function Chips<T extends string | number>({
  legend,
  hint,
  options,
  values,
  onToggle,
}: {
  legend: string;
  hint?: string;
  options: { value: T; label: string }[];
  values: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">{legend}</legend>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className={chipClass}>
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Profil sportif : niveau, objectif, lieu, matériel, jours, durée et zones à ménager. */
export function TrainingProfileForm({ initial }: { initial: Draft | null }) {
  const t = useTranslations("training");
  const errorText = useErrorText();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial ?? DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const showEquipment = draft.place === "home_equipped" || draft.place === "outdoor";

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveTrainingProfileAction({
        ...draft,
        equipment: showEquipment ? draft.equipment : [],
      });
      if (result?.error) setError(result.error === "invalid_form" ? "training_days_required" : result.error);
      else router.push("/training");
    });

  return (
    <form action={save} className="flex flex-col gap-6">
      <OptionList
        legend={t("setup.level")}
        name="level"
        value={draft.level}
        onChange={(value) => set("level", value)}
        options={TRAINING_LEVELS.map((level) => ({
          value: level,
          label: t(`levels.${level}`),
          hint: t(`levels.${level}Hint`),
        }))}
      />
      <OptionList
        legend={t("setup.goal")}
        name="goal"
        value={draft.goal}
        onChange={(value) => set("goal", value)}
        options={TRAINING_GOALS.map((goal) => ({ value: goal, label: t(`goals.${goal}`) }))}
      />
      <OptionList<Place>
        legend={t("setup.place")}
        name="place"
        value={draft.place}
        onChange={(value) => set("place", value)}
        options={PLACES.map((place) => ({ value: place, label: t(`places.${place}`) }))}
      />
      {showEquipment && (
        <Chips
          legend={t("setup.equipment")}
          hint={t("setup.equipmentHint")}
          options={HOME_EQUIPMENT.map((item) => ({ value: item, label: t(`equipment.${item}`) }))}
          values={draft.equipment}
          onToggle={(value) => set("equipment", toggle(draft.equipment, value))}
        />
      )}
      <Chips
        legend={t("setup.days")}
        options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({
          value: day,
          label: t(`weekdays.${String(day) as "0"}`),
        }))}
        values={draft.days}
        onToggle={(value) => set("days", toggle(draft.days, value))}
      />
      <OptionList
        legend={t("setup.minutes")}
        name="minutes"
        value={draft.minutes}
        onChange={(value) => set("minutes", value)}
        options={SESSION_MINUTES.map((minutes) => ({ value: minutes, label: t("minutes", { count: minutes }) }))}
      />
      <Chips
        legend={t("setup.zones")}
        hint={t("setup.zonesHint")}
        options={ZONES.map((zone) => ({ value: zone, label: t(`zones.${zone}`) }))}
        values={draft.avoidZones}
        onToggle={(value) => set("avoidZones", toggle(draft.avoidZones, value))}
      />
      {error && <Alert>{errorText(error)}</Alert>}
      <Button type="submit" disabled={pending || draft.days.length === 0}>
        {t("setup.save")}
      </Button>
    </form>
  );
}
