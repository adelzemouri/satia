"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActionState } from "@/server/action-result";
import { Alert } from "@/ui/alert";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useToast } from "@/ui/toast";

/**
 * Réglage plein écran d'un objectif : × pour revenir à Moi sans rien changer, ✓ pour
 * enregistrer, une question en titre, la valeur en grand au milieu et un repère en bas.
 */
export function GoalScreen({
  title,
  subtitle,
  children,
  note,
  save,
  canSave = true,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  save: () => Promise<ActionState>;
  canSave?: boolean;
}) {
  const t = useTranslations("goals");
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await save();
      if (result?.error) return setError(result.error);
      haptic();
      toast({ message: t("saved") });
      router.push("/profile");
    });

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            aria-label={t("cancel")}
            className="flex size-12 items-center justify-center rounded-full bg-surface-muted transition-transform duration-[120ms] ease-out-strong active:scale-[0.94]"
          >
            <Icon name="close" />
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSave}
            aria-label={t("save")}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/30 transition-transform duration-[120ms] ease-out-strong active:scale-[0.94] disabled:opacity-50"
          >
            <Icon name="check" size={24} />
          </button>
        </div>
        <h1 className="mt-6 text-center font-display text-3xl leading-tight font-extrabold tracking-tight text-balance">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-center text-text-muted">{subtitle}</p>}
        <div className="flex flex-1 flex-col justify-center gap-5 py-8">{children}</div>
        {error && <Alert>{errorText(error)}</Alert>}
        {note && <div className="mt-4">{note}</div>}
      </div>
    </div>
  );
}

/** Repère en bas d'un réglage : objectif conseillé, zone de poids de forme… */
export function GoalNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-primary-soft p-4">
      <span className="mt-0.5 text-primary">
        <Icon name="check" />
      </span>
      <p className="flex flex-col gap-1">
        <span className="font-bold text-primary">{title}</span>
        <span className="text-sm">{children}</span>
      </p>
    </div>
  );
}

/** Valeur en grand, avec son unité. */
export function BigValue({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="flex items-baseline justify-center gap-2" aria-hidden="true">
      <span className="font-display text-7xl leading-none font-extrabold tracking-tight tabular-nums">{value}</span>
      <span className="text-xl font-bold text-text-muted">{unit}</span>
    </p>
  );
}
