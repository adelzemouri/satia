"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import {
  fiberLevel,
  NUTRISCORE_GRADES,
  type NutriscoreGrade,
  novaMarkerKey,
  qualityVerdict,
  saltLevel,
  sugarsLevel,
} from "@/domain/quality";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

type Props = {
  nutriscore: NutriscoreGrade | null;
  novaGroup: number | null;
  /** Ce qui classe le produit en NOVA 4, null tant que le produit n'a pas été relu. */
  novaMarkers: readonly string[] | null;
  fiberG: number | null;
  sugarsG: number | null;
  saltG: number | null;
};

const NOVA_GROUPS = [1, 2, 3, 4] as const;

/**
 * Badges Nutri-Score et NOVA de la fiche aliment : un toucher ouvre une fiche courte qui dit ce
 * que mesure chaque badge et ce qui compte pour ce produit. Une phrase les résume quand ils
 * semblent se contredire (Nutri-Score A et NOVA 4, par exemple).
 */
export function QualityBadges({ nutriscore, novaGroup, novaMarkers, fiberG, sugarsG, saltG }: Props) {
  const t = useTranslations("quality");
  const tm = useTranslations("novaMarkers");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<"nutriscore" | "nova" | null>(null);
  const verdict = qualityVerdict(nutriscore, novaGroup);
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  // Le sel se lit au centième (0,96 g), arrondi à 1 g il paraîtrait plus salé.
  const saltNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const show = (which: "nutriscore" | "nova") => {
    setOpen(which);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const markerLabel = (tag: string) => {
    const parsed = novaMarkerKey(tag);
    if ("additive" in parsed) return parsed.additive;
    // Marqueur absent de notre liste : son nom Open Food Facts, lisible.
    const key = parsed.key as Parameters<typeof tm>[0];
    return tm.has(key) ? tm(key) : parsed.key.replaceAll("-", " ");
  };

  const facts = [
    fiberG !== null && {
      label: t("fiber"),
      value: number.format(fiberG),
      level: t(`fiberLevel.${fiberLevel(fiberG)}`),
    },
    sugarsG !== null && {
      label: t("sugars"),
      value: number.format(sugarsG),
      level: t(`level.${sugarsLevel(sugarsG)}`),
    },
    saltG !== null && { label: t("salt"), value: saltNumber.format(saltG), level: t(`level.${saltLevel(saltG)}`) },
  ].filter((fact) => fact !== false);

  const badgeClass =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface-muted py-2 pr-3 pl-4 font-semibold transition active:scale-[0.97]";

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2" aria-label={t("labels")}>
        {nutriscore && (
          <li>
            <button type="button" className={badgeClass} onClick={() => show("nutriscore")} aria-haspopup="dialog">
              {t("nutriscore", { grade: nutriscore.toUpperCase() })}
              <InfoIcon />
            </button>
          </li>
        )}
        {novaGroup && (
          <li>
            <button type="button" className={badgeClass} onClick={() => show("nova")} aria-haspopup="dialog">
              {t("nova", { group: novaGroup })}
              <InfoIcon />
            </button>
          </li>
        )}
      </ul>
      {verdict && <p className="text-sm text-text-muted">{t(`verdict.${verdict}`)}</p>}

      {/* Échap et le bouton Fermer ferment au clavier ; le clic sur le fond grisé est un raccourci tactile. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        aria-labelledby="quality-sheet-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setOpen(null)}
        className="sheet-in fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-text backdrop:bg-black/40 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-md lg:rounded-3xl"
      >
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:pt-5">
          <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border lg:hidden" />
          <div className="flex items-center gap-3">
            <h2 id="quality-sheet-title" className="flex-1 font-display text-xl font-bold text-balance">
              {open === "nova" && novaGroup
                ? t("novaTitle", { group: novaGroup })
                : nutriscore
                  ? t("nutriscore", { grade: nutriscore.toUpperCase() })
                  : null}
            </h2>
            <Button variant="ghost" onClick={close} aria-label={t("close")} className="min-h-11 px-3">
              <Icon name="close" />
            </Button>
          </div>

          {open === "nutriscore" && nutriscore && (
            <>
              <Scale
                label={t("nutriscoreScale")}
                steps={NUTRISCORE_GRADES.map((grade) => ({ id: grade, text: grade.toUpperCase() }))}
                current={nutriscore}
              />
              <p>{t.rich("nutriscoreExplain", { b: (chunks) => <strong>{chunks}</strong> })}</p>
              {facts.length > 0 && (
                <section aria-labelledby="quality-facts" className="flex flex-col gap-2">
                  <h3 id="quality-facts" className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                    {t("whatCounts")}
                  </h3>
                  <dl className="flex flex-col gap-1.5">
                    {facts.map((fact) => (
                      <div key={fact.label} className="flex justify-between gap-3 tabular-nums">
                        <dt>{fact.label}</dt>
                        <dd className="font-semibold">
                          {fact.value} g · {fact.level}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <p className="text-sm text-text-muted">{t("nutriscoreSource")}</p>
            </>
          )}

          {open === "nova" && novaGroup && (
            <>
              <Scale
                label={t("novaScale")}
                steps={NOVA_GROUPS.map((group) => ({
                  id: String(group),
                  text: String(group),
                  sub: t(`novaShort.${group}`),
                }))}
                current={String(novaGroup)}
              />
              <p>{t.rich("novaExplain", { b: (chunks) => <strong>{chunks}</strong> })}</p>
              <p>{t(`novaGroupText.${String(novaGroup) as "1" | "2" | "3" | "4"}`)}</p>
              {novaGroup === 4 && novaMarkers && novaMarkers.length > 0 && (
                <section aria-labelledby="quality-markers" className="flex flex-col gap-2">
                  <h3 id="quality-markers" className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                    {t("novaMarkersTitle")}
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {novaMarkers.map((tag) => (
                      <li key={tag} className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold">
                        {markerLabel(tag)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {novaGroup === 4 && (
                <p className="rounded-xl bg-primary-soft px-3 py-2.5 text-sm">
                  {verdict === "goodButProcessed" ? t("novaReassureGood") : t("novaReassure")}
                </p>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width={15} height={15} fill="none" className="text-text-muted">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.2v4M8 4.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Échelle de A à E ou de 1 à 4, la case du produit mise en avant (aux couleurs de l'app, pas du logo). */
function Scale({
  label,
  steps,
  current,
}: {
  label: string;
  steps: readonly { id: string; text: string; sub?: string }[];
  current: string;
}) {
  return (
    <ol aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((step) => {
        const here = step.id === current;
        return (
          <li
            key={step.id}
            aria-current={here ? "true" : undefined}
            className={`rounded-xl px-0.5 py-1.5 text-center leading-tight font-bold ${
              here ? "bg-primary text-on-primary" : "bg-surface-muted text-text-muted"
            }`}
          >
            {step.text}
            {step.sub && <span className="block text-[0.7rem] font-medium">{step.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}
