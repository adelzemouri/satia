"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { scanBarcodeAction } from "@/features/journal/actions";
import type { MealSlot } from "@/domain/meals";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";

import { useBarcodeScanner } from "./use-barcode-scanner";

/** Scan d'un code-barres (ou saisie des chiffres), puis ouverture de la fiche produit. */
export function ScanView({ date, slot }: { date: string; slot: MealSlot }) {
  const t = useTranslations("scan");
  const errorText = useErrorText();
  const router = useRouter();
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [pending, startTransition] = useTransition();

  const lookUp = useCallback(
    (code: string) => {
      setActive(false);
      setError(null);
      startTransition(async () => {
        const result = await scanBarcodeAction(code);
        if (result?.id) {
          router.push({ pathname: `/foods/${result.id}`, query: { date, slot, via: "barcode" } });
        } else {
          setError(result?.error ?? "generic");
        }
      });
    },
    [date, slot, router],
  );

  const { video, status } = useBarcodeScanner(active, lookUp);

  return (
    <div className="flex flex-col gap-4">
      {active && (
        <div
          className={`relative overflow-hidden rounded-[var(--radius-card)] bg-black ${
            status === "denied" || status === "unsupported" ? "hidden" : ""
          }`}
        >
          <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label={t("hint")} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[12%] top-1/2 h-28 -translate-y-1/2 rounded-2xl border-4 border-white/80"
          />
        </div>
      )}
      <p className="text-text-muted" aria-live="polite">
        {pending
          ? t("searching")
          : active && status === "starting"
            ? t("starting")
            : active && status === "scanning"
              ? t("hint")
              : null}
      </p>
      {active && status === "denied" && <Alert tone="info">{t("denied")}</Alert>}
      {active && status === "unsupported" && <Alert tone="info">{t("unsupported")}</Alert>}

      {error && (
        <div className="flex flex-col gap-3">
          <Alert>{errorText(error)}</Alert>
          {error === "barcode_not_found" && (
            <>
              <p>{t("notFoundHelp")}</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/foods/new" className={buttonClass("primary")}>
                  {t("createFood")}
                </Link>
                <Link href={{ pathname: "/add", query: { date, slot } }} className={buttonClass("secondary")}>
                  {t("searchByName")}
                </Link>
              </div>
            </>
          )}
          <Button variant="ghost" onClick={() => (setError(null), setActive(true))}>
            {t("again")}
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) lookUp(manual.trim());
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("manualLabel")}</span>
          <span className="text-sm text-text-muted">{t("manualHint")}</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            className="min-h-12 rounded-2xl border border-border bg-surface px-4 text-base"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("search")}
        </Button>
      </form>
    </div>
  );
}
