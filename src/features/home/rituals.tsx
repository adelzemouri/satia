"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { CoachAvatar } from "@/features/coach/coach-avatar";
import { useErrorText } from "@/features/auth/use-error-text";
import { setWeightAction } from "@/features/journal/actions";
import { Link, useRouter } from "@/i18n/navigation";
import type { Ritual, Victory, WeighWeek } from "@/domain/rituals";
import { Alert } from "@/ui/alert";
import { Button, buttonClass } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/motion";
import { useWeightShown } from "@/ui/private";
import { useToast } from "@/ui/toast";

import { Celebration } from "./streak-celebration";
import { snoozeRitualAction } from "./actions";

const CARD = "relative flex w-full shrink-0 snap-center flex-col gap-3 rounded-[var(--radius-card)] p-5";
const CARD_BG = "bg-linear-160 from-primary-soft from-0% to-surface to-70%";

function useDates() {
  const locale = useLocale();
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
  return {
    short: (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(at(iso)),
    long: (iso: string) =>
      new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
        at(iso),
      ),
    weekday: (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(at(iso)),
  };
}

/** Cases des dernières semaines de pesée : pleines quand la pesée est faite, la semaine en cours cerclée. */
function Weeks({ weeks, today }: { weeks: WeighWeek[]; today: string }) {
  const t = useTranslations("home.rituals");
  const dates = useDates();
  return (
    <ol aria-label={t("weeksLabel", { count: weeks.length })} className="flex gap-1.5">
      {weeks.map((week, index) => {
        const current = index === weeks.length - 1;
        return (
          <li
            key={week.start}
            className={`flex min-h-8 flex-1 items-center justify-center rounded-xl text-xs font-bold ${
              week.done
                ? "bg-primary text-on-primary"
                : current
                  ? "border-2 border-pomme bg-surface text-pomme"
                  : "border-[1.5px] border-dashed border-border bg-surface text-text-muted"
            }`}
          >
            <span aria-hidden="true">{current && week.start === today ? t("weekToday") : dates.short(week.start)}</span>
            <span className="sr-only">
              {t(week.done ? "weekDone" : "weekMissing", { date: dates.short(week.start) })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CardHead({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <CoachAvatar size={52} />
      <div className="min-w-0">
        <p className="text-xs font-extrabold tracking-wider text-text-muted uppercase">{eyebrow}</p>
        <h2 id={id} className="font-display text-xl leading-tight font-extrabold tracking-tight text-balance">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Later({ kind }: { kind: Ritual["kind"] }) {
  const t = useTranslations("home.rituals");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => snoozeRitualAction(kind))}
      className="min-h-12 rounded-full px-3 font-semibold text-text-muted hover:text-text disabled:opacity-60"
    >
      {t("later")}
    </button>
  );
}

/** Saisie du poids en un geste, sans quitter l'accueil. */
function WeighSheet({
  today,
  lastWeight,
  nextWeigh,
  onClose,
}: {
  today: string;
  lastWeight: number | null;
  nextWeigh: string;
  onClose: () => void;
}) {
  const t = useTranslations("home.rituals");
  const errorText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const dates = useDates();
  const locale = useLocale();
  // Le poids n'est prérempli que s'il est affiché (il est masqué par défaut).
  const shown = useWeightShown();
  const [value, setValue] = useState(shown && lastWeight !== null ? String(lastWeight) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const parsed = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(parsed);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const step = (delta: number) => {
    const base = valid ? parsed : (lastWeight ?? 70);
    setValue(decimal.format(Math.round((base + delta) * 10) / 10));
  };

  const save = () =>
    startTransition(async () => {
      const result = await setWeightAction({ date: today, weightKg: parsed });
      if (result?.error) {
        setError(result.fieldErrors?.weightKg ?? result.error);
        return;
      }
      haptic(15);
      toast({ message: t("weighSaved", { date: dates.long(nextWeigh) }) });
      onClose();
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center lg:items-center">
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 bg-text/45" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="weigh-sheet-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save();
        }}
        className="sheet-in relative flex w-full max-w-md flex-col gap-4 rounded-t-[1.75rem] bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:rounded-[1.75rem] lg:pb-6"
      >
        <span aria-hidden="true" className="h-1.5 w-10 self-center rounded-full bg-border lg:hidden" />
        <h2 id="weigh-sheet-title" className="font-display text-2xl font-extrabold tracking-tight">
          {t("sheetTitle")}
        </h2>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label={t("less")}
            onClick={() => step(-0.1)}
            className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Icon name="minus" size={22} />
          </button>
          <label className="flex items-baseline gap-1.5">
            <span className="sr-only">{t("weightLabel")}</span>
            <input
              ref={input}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              placeholder={t("placeholder")}
              aria-describedby="weigh-sheet-hint"
              className="w-[5ch] bg-transparent text-center font-display text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-border focus-visible:underline"
            />
            <span className="text-lg text-text-muted">kg</span>
          </label>
          <button
            type="button"
            aria-label={t("more")}
            onClick={() => step(0.1)}
            className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Icon name="plus" size={22} />
          </button>
        </div>
        <p id="weigh-sheet-hint" className="text-center text-sm text-text-muted">
          {t("sheetHint")}
        </p>
        {error && <Alert>{errorText(error)}</Alert>}
        <Button type="submit" disabled={pending || !valid}>
          {t("save")}
        </Button>
      </form>
    </div>
  );
}

export type RitualsDone = { weeks: WeighWeek[]; nextWeigh: string } | null;

/**
 * Les rendez-vous de Pépin sur l'accueil : un rituel à la fois (on glisse pour le suivant),
 * ou, la pesée de la semaine faite, la date du prochain rendez-vous pour le reste de la journée.
 */
export function RitualCards({
  rituals,
  done,
  today,
  lastWeight,
  nextWeigh,
}: {
  rituals: Ritual[];
  done: RitualsDone;
  today: string;
  lastWeight: number | null;
  nextWeigh: string;
}) {
  const t = useTranslations("home.rituals");
  const dates = useDates();
  const [sheet, setSheet] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  if (rituals.length === 0) {
    if (!done) return null;
    return (
      <section aria-labelledby="ritual-done" className={`${CARD} ${CARD_BG}`}>
        <CardHead
          id="ritual-done"
          eyebrow={t("doneEyebrow")}
          title={t("doneTitle", { date: dates.long(done.nextWeigh) })}
        />
        <p className="text-sm text-text-muted">{t("doneBody")}</p>
        <Weeks weeks={done.weeks} today={today} />
      </section>
    );
  }

  const onScroll = () => {
    const element = track.current;
    if (element) setIndex(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
  };

  return (
    <section aria-label={t("label")} className="flex flex-col gap-2">
      <div
        ref={track}
        onScroll={onScroll}
        data-swipe-lock={rituals.length > 1 ? true : undefined}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto [contain:inline-size]"
      >
        {rituals.map((ritual, position) => {
          const id = `ritual-${ritual.kind}`;
          const pager = rituals.length > 1 && (
            <p className="sr-only">{t("pager", { index: position + 1, count: rituals.length })}</p>
          );
          if (ritual.kind === "weigh") {
            return (
              <article key={id} aria-labelledby={id} className={`${CARD} ${CARD_BG}`}>
                {pager}
                <CardHead
                  id={id}
                  eyebrow={t("weighEyebrow", { day: dates.weekday(ritual.status.periodStart) })}
                  title={t("weighTitle")}
                />
                <p className="text-sm text-text-muted">
                  {ritual.nextStreak >= 2 ? t("weighStreak", { weeks: ritual.nextStreak }) : t("weighBody")}
                </p>
                <Weeks weeks={ritual.status.weeks} today={today} />
                <div className="flex items-center gap-1">
                  <Button onClick={() => setSheet(true)}>
                    <Icon name="weight" size={20} />
                    {t("weighAction")}
                  </Button>
                  <Later kind="weigh" />
                </div>
              </article>
            );
          }
          const first = ritual.last === null;
          const key = ritual.kind;
          return (
            <article key={id} aria-labelledby={id} className={`${CARD} ${CARD_BG}`}>
              {pager}
              <CardHead id={id} eyebrow={t(`${key}Eyebrow`)} title={t(first ? `${key}FirstTitle` : `${key}Title`)} />
              <p className="text-sm text-text-muted">
                {first ? t(`${key}FirstBody`) : t(`${key}Body`, { date: dates.short(ritual.last!) })}
              </p>
              <div className="mt-auto flex items-center gap-1">
                <Link href={key === "measure" ? "/body#measure-title" : "/body#photos-title"} className={buttonClass()}>
                  <Icon name={key === "measure" ? "ruler" : "camera"} size={20} />
                  {t(`${key}Action`)}
                </Link>
                <Later kind={key} />
              </div>
            </article>
          );
        })}
      </div>
      {rituals.length > 1 && (
        <div aria-hidden="true" className="flex justify-center gap-1.5">
          {rituals.map((ritual, position) => (
            <span
              key={ritual.kind}
              className={`h-2 rounded-full transition-all ${position === index ? "w-5 bg-primary" : "w-2 bg-border"}`}
            />
          ))}
        </div>
      )}
      {sheet && (
        <WeighSheet today={today} lastWeight={lastWeight} nextWeigh={nextWeigh} onClose={() => setSheet(false)} />
      )}
    </section>
  );
}

const SEEN_PREFIX = "pommelia:victory:";

/**
 * Annonce d'une étape de régularité : plein écran pour les grandes, simple message pour les
 * petites (première mensuration, première photo). Une seule fois par appareil.
 */
export function VictoryAnnouncement({ victory }: { victory: Victory }) {
  const t = useTranslations("home.victory");
  const toast = useToast();
  const { id, kind, count, big } = victory;

  useEffect(() => {
    if (big) return;
    const key = `${SEEN_PREFIX}${id}`;
    try {
      if (localStorage.getItem(key) !== null) return;
      localStorage.setItem(key, "1");
    } catch {
      // Stockage indisponible : le message peut revenir à la prochaine visite, sans gravité.
    }
    toast({ message: t(`${kind}First`) });
  }, [big, id, kind, t, toast]);

  if (!big) return null;
  return (
    <Celebration
      storageKey={`victory:${id}`}
      eyebrow={t("eyebrow")}
      title={t(`${kind}Title`, { count })}
      body={t(`${kind}Body`)}
    />
  );
}
