"use client";

import { useTranslations } from "next-intl";

import type { CalorieFloors } from "@/domain/energy";
import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { useFormAction } from "@/ui/use-form-action";

import { saveFloorsAction } from "./actions";

export function FloorsForm({ floors }: { floors: CalorieFloors }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useFormAction(saveFloorsAction, null);
  return (
    <form {...action} className="flex flex-col gap-3">
      <p className="text-text-muted">{t("admin.floorsHint")}</p>
      {state?.error && <Alert>{errorText(state.error === "invalid_form" ? "generic" : state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("common.save")} ✓</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("admin.floorFemale")}
          name="female"
          type="number"
          min={1000}
          max={2500}
          step={10}
          defaultValue={floors.female}
        />
        <Field
          label={t("admin.floorMale")}
          name="male"
          type="number"
          min={1000}
          max={3000}
          step={10}
          defaultValue={floors.male}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
