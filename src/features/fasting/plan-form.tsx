"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  CUSTOM_MAX_HOURS,
  CUSTOM_MIN_HOURS,
  FASTING_PROTOCOLS,
  type FastingPlan,
  type FastingProtocol,
} from "@/domain/fasting";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";

import { saveFastingPlanAction } from "./actions";

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

/** Planning du jeûne : protocole et heure de début pour chaque jour de la semaine. */
export function FastingPlanForm({ plan }: { plan: FastingPlan }) {
  const t = useTranslations("fasting.plan");
  const tw = useTranslations("training.weekdays");
  const errorText = useErrorText();
  const [draft, setDraft] = useState(plan);
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const setDay = (index: number, day: FastingPlan["days"][number]) =>
    setDraft((current) => ({ ...current, days: current.days.map((value, i) => (i === index ? day : value)) }));
  const usesCustom = draft.days.some((day) => day?.protocol === "custom");

  const save = () =>
    startTransition(async () => {
      const result = await saveFastingPlanAction(draft);
      setState(result?.error ? { error: Object.values(result.fieldErrors ?? {})[0] ?? result.error } : result);
    });

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="flex min-h-12 items-start gap-3">
        <input
          id="fasting-enabled"
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <label htmlFor="fasting-enabled" className="cursor-pointer font-semibold">
          {t("enabled")}
        </label>
      </div>
      <div className="flex min-h-12 items-start gap-3">
        <input
          id="fasting-auto"
          type="checkbox"
          checked={draft.autoStart}
          onChange={(event) => setDraft({ ...draft, autoStart: event.target.checked })}
          aria-describedby="fasting-auto-hint"
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span className="flex flex-col">
          <label htmlFor="fasting-auto" className="cursor-pointer font-semibold">
            {t("autoStart")}
          </label>
          <span id="fasting-auto-hint" className="text-sm text-text-muted">
            {t("autoStartHint")}
          </span>
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("days")}</legend>
        <p className="text-sm text-text-muted">{t("daysHint")}</p>
        {draft.days.map((day, index) => {
          const weekday = tw(String(index) as "0");
          return (
            <div key={index} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
              <span className="font-semibold">{weekday}</span>
              <select
                aria-label={t("protocolFor", { day: weekday })}
                value={day?.protocol ?? ""}
                onChange={(event) =>
                  setDay(
                    index,
                    event.target.value
                      ? { protocol: event.target.value as FastingProtocol, start: day?.start ?? "20:00" }
                      : null,
                  )
                }
                className={selectClass}
              >
                <option value="">{t("none")}</option>
                {FASTING_PROTOCOLS.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocol === "custom" ? t("custom") : protocol}
                  </option>
                ))}
              </select>
              <input
                type="time"
                aria-label={t("startFor", { day: weekday })}
                value={day?.start ?? ""}
                disabled={!day}
                required={Boolean(day)}
                onChange={(event) => day && setDay(index, { ...day, start: event.target.value })}
                className={`${selectClass} disabled:opacity-60`}
              />
            </div>
          );
        })}
      </fieldset>

      {usesCustom && (
        <Field
          label={t("customHours")}
          hint={t("customHint", { min: CUSTOM_MIN_HOURS, max: CUSTOM_MAX_HOURS })}
          name="customHours"
          type="number"
          min={CUSTOM_MIN_HOURS}
          max={CUSTOM_MAX_HOURS}
          value={draft.customHours}
          onChange={(event) => setDraft({ ...draft, customHours: Number(event.target.value) })}
        />
      )}

      {state?.error && <Alert>{errorText(state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
