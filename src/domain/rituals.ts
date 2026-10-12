import { addDays } from "./energy";

/**
 * Rituels de suivi (calcul pur) : la pesée hebdomadaire au jour choisi, les mensurations et la
 * photo de progrès une fois par mois. L'accueil propose ceux qui sont dus, un à la fois, et
 * annonce les étapes de régularité franchies. Jamais de victoire liée aux kilos perdus.
 */

export const RITUAL_KINDS = ["weigh", "measure", "photo"] as const;
export type RitualKind = (typeof RITUAL_KINDS)[number];

/** Le rappel de pesée reste proposé le jour choisi et les deux jours suivants, puis s'efface. */
export const WEIGH_SHOW_DAYS = 3;
/** Mensurations et photo reviennent quatre semaines après la dernière fois. */
export const MONTHLY_EVERY_DAYS = 28;
/** « Plus tard » : demain pour la pesée, dans une semaine pour les rituels du mois. */
export const SNOOZE_DAYS: Record<RitualKind, number> = { weigh: 1, measure: 7, photo: 7 };
/** Cases de semaines affichées sur la carte de pesée (la semaine en cours comprise). */
export const WEEKS_SHOWN = 4;

export const WEIGH_MILESTONES = [4, 8, 12, 26, 52] as const;
export const MEASURE_MILESTONES = [1, 3, 6, 12] as const;
export const PHOTO_MILESTONES = [1, 3, 6] as const;
/** Une victoire n'est annoncée que si la saisie qui l'a fait franchir date de moins de 3 jours. */
const VICTORY_FRESH_DAYS = 2;

export type RitualPrefs = {
  weighIn: boolean;
  /** Jour de pesée : 1 = lundi … 7 = dimanche. */
  weighDay: number;
  measurements: boolean;
  progressPhoto: boolean;
};

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(isoDate: string): number {
  return ((new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** Début de la « semaine de pesée » en cours : le dernier jour de pesée, aujourd'hui compris. */
export function weighPeriodStart(today: string, weighDay: number): string {
  return addDays(today, -((isoWeekday(today) - weighDay + 7) % 7));
}

export type WeighWeek = { start: string; done: boolean };
export type WeighStatus = {
  periodStart: string;
  doneThisPeriod: boolean;
  /** Semaines d'affilée avec au moins une pesée (la semaine en cours compte dès qu'elle est faite). */
  streak: number;
  weeks: WeighWeek[];
};

export function weighStatus(weighDates: readonly string[], today: string, weighDay: number): WeighStatus {
  const periodStart = weighPeriodStart(today, weighDay);
  const done = (start: string) => weighDates.some((date) => date >= start && date < addDays(start, 7));
  const doneThisPeriod = weighDates.some((date) => date >= periodStart && date <= today);
  const earliest = weighDates.reduce((min, date) => (date < min ? date : min), today);
  let streak = doneThisPeriod ? 1 : 0;
  for (
    let start = addDays(periodStart, -7);
    start >= addDays(earliest, -6) && done(start);
    start = addDays(start, -7)
  ) {
    streak += 1;
  }
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const start = addDays(periodStart, -7 * (WEEKS_SHOWN - 1 - index));
    return { start, done: index === WEEKS_SHOWN - 1 ? doneThisPeriod : done(start) };
  });
  return { periodStart, doneThisPeriod, streak, weeks };
}

const latest = (dates: readonly string[]) =>
  dates.reduce<string | null>((max, date) => (max === null || date > max ? date : max), null);

export type Ritual =
  { kind: "weigh"; status: WeighStatus; nextStreak: number } | { kind: "measure" | "photo"; last: string | null };

export type RitualInput = {
  today: string;
  prefs: RitualPrefs;
  weighDates: readonly string[];
  measureDates: readonly string[];
  photoDates: readonly string[];
  /** Rituels repoussés avec « Plus tard » : date jusqu'à laquelle ils sont masqués (exclue). */
  snoozedUntil?: Partial<Record<RitualKind, string>>;
};

/** Le rituel du mois revient-il aujourd'hui (ou n'a-t-il jamais été fait) ? */
export function monthlyDue(dates: readonly string[], today: string): boolean {
  const last = latest(dates);
  return last === null || today >= addDays(last, MONTHLY_EVERY_DAYS);
}

/** Rituels à proposer sur l'accueil, dans l'ordre : pesée, mensurations, photo. */
export function dueRituals(input: RitualInput): Ritual[] {
  const { today, prefs } = input;
  const snoozed = (kind: RitualKind) => {
    const until = input.snoozedUntil?.[kind];
    return until !== undefined && today < until;
  };
  const due: Ritual[] = [];
  if (prefs.weighIn && !snoozed("weigh")) {
    const status = weighStatus(input.weighDates, today, prefs.weighDay);
    const sinceStart = (Date.parse(today) - Date.parse(status.periodStart)) / 86_400_000;
    if (!status.doneThisPeriod && sinceStart < WEIGH_SHOW_DAYS) {
      due.push({
        kind: "weigh",
        status,
        nextStreak: weighStatus([...input.weighDates, today], today, prefs.weighDay).streak,
      });
    }
  }
  if (prefs.measurements && !snoozed("measure") && monthlyDue(input.measureDates, today)) {
    due.push({ kind: "measure", last: latest(input.measureDates) });
  }
  if (prefs.progressPhoto && !snoozed("photo") && monthlyDue(input.photoDates, today)) {
    due.push({ kind: "photo", last: latest(input.photoDates) });
  }
  return due;
}

/** Prochain rendez-vous de pesée, une fois celle de la semaine faite. */
export function nextWeighDay(today: string, weighDay: number): string {
  return addDays(weighPeriodStart(today, weighDay), 7);
}

export type Victory = {
  /** Identifiant stable : une victoire n'est annoncée qu'une fois par appareil. */
  id: string;
  kind: RitualKind;
  count: number;
  /** Grande étape : plein écran ; petite : un simple message. */
  big: boolean;
};

const months = (dates: readonly string[]) => new Set(dates.map((date) => date.slice(0, 7))).size;

/**
 * Étape de régularité tout juste franchie, s'il y en a une. Grandes étapes d'abord ; une
 * semaine ou un mois manqué ne retire rien, il n'y a simplement pas de nouvelle victoire.
 */
export function freshVictory(
  input: Omit<RitualInput, "prefs" | "snoozedUntil"> & { weighDay: number },
): Victory | null {
  const { today } = input;
  const fresh = (dates: readonly string[]) => {
    const last = latest(dates);
    return last !== null && last >= addDays(today, -VICTORY_FRESH_DAYS) && last <= today;
  };
  const found: Victory[] = [];
  const weigh = weighStatus(input.weighDates, today, input.weighDay);
  if (
    weigh.doneThisPeriod &&
    fresh(input.weighDates) &&
    (WEIGH_MILESTONES as readonly number[]).includes(weigh.streak)
  ) {
    found.push({ id: `weigh:${weigh.streak}:${weigh.periodStart}`, kind: "weigh", count: weigh.streak, big: true });
  }
  for (const [kind, dates, milestones] of [
    ["measure", input.measureDates, MEASURE_MILESTONES],
    ["photo", input.photoDates, PHOTO_MILESTONES],
  ] as const) {
    const count = months(dates);
    if (fresh(dates) && (milestones as readonly number[]).includes(count)) {
      found.push({ id: `${kind}:${count}`, kind, count, big: count > 1 });
    }
  }
  return found.find((victory) => victory.big) ?? found[0] ?? null;
}

/**
 * Rituels à rappeler par notification aujourd'hui : la pesée le jour choisi seulement, les
 * rituels du mois le jour où ils reviennent (jamais pour une première fois, ni en rattrapage).
 */
export function ritualsToNotify(input: Omit<RitualInput, "snoozedUntil">): RitualKind[] {
  const { today, prefs } = input;
  const kinds: RitualKind[] = [];
  if (
    prefs.weighIn &&
    isoWeekday(today) === prefs.weighDay &&
    !weighStatus(input.weighDates, today, prefs.weighDay).doneThisPeriod
  ) {
    kinds.push("weigh");
  }
  const returnsToday = (dates: readonly string[]) => {
    const last = latest(dates);
    return last !== null && today === addDays(last, MONTHLY_EVERY_DAYS);
  };
  if (prefs.measurements && returnsToday(input.measureDates)) kinds.push("measure");
  if (prefs.progressPhoto && returnsToday(input.photoDates)) kinds.push("photo");
  return kinds;
}

/** Cookie des rituels repoussés sur cet appareil : `weigh:2026-10-13,measure:2026-10-19`. */
export const SNOOZE_COOKIE = "pommelia.later";

export function parseSnoozes(value: string | undefined): Partial<Record<RitualKind, string>> {
  const snoozes: Partial<Record<RitualKind, string>> = {};
  for (const part of value?.split(",") ?? []) {
    const [kind, until] = part.split(":");
    if ((RITUAL_KINDS as readonly string[]).includes(kind ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(until ?? "")) {
      snoozes[kind as RitualKind] = until;
    }
  }
  return snoozes;
}

export function serializeSnoozes(snoozes: Partial<Record<RitualKind, string>>, today: string): string {
  return Object.entries(snoozes)
    .filter(([, until]) => until !== undefined && until > today)
    .map(([kind, until]) => `${kind}:${until}`)
    .join(",");
}
