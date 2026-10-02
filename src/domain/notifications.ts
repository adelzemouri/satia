/** Notifications (calcul pur) : préférences, plages silencieuses et rappels dus. */

export const NOTIFICATION_KINDS = ["meal", "water", "weekly_review"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationPrefs = {
  meals: boolean;
  water: boolean;
  weeklyReview: boolean;
  /** Plage silencieuse « HH:MM » ; elle peut passer minuit (22:00 → 07:30). */
  quietStart: string;
  quietEnd: string;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  meals: true,
  water: true,
  weeklyReview: true,
  quietStart: "22:00",
  quietEnd: "07:30",
};

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/** Heure locale « HH:MM » et date « AAAA-MM-JJ » d'un instant dans un fuseau. */
export function localClock(now: Date, timeZone: string): { date: string; time: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday!) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday };
}

export function isQuiet(time: string, start: string, end: string): boolean {
  const now = minutesOf(time);
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** Un rappel de repas part 30 min après l'horaire habituel, et plus après 3 h. */
const MEAL_DELAY = 30;
const MEAL_WINDOW = 180;
/** Points d'étape de l'hydratation : à cette heure, on attend cette part de l'objectif. */
export const WATER_CHECKPOINTS = [
  { time: "11:00", share: 0.3 },
  { time: "15:00", share: 0.6 },
  { time: "18:00", share: 0.8 },
] as const;
const WATER_WINDOW = 120;
/** Le bilan de la semaine est annoncé le lundi matin. */
const REVIEW_FROM = "09:00";
const REVIEW_UNTIL = "13:00";

export type ReminderSlot = "breakfast" | "lunch" | "dinner";

export type Reminder =
  | { kind: "meal"; key: string; slot: ReminderSlot }
  | { kind: "water"; key: string; glasses: number; goal: number }
  | { kind: "weekly_review"; key: string };

export type ReminderInput = {
  date: string;
  time: string;
  /** 1 = lundi … 7 = dimanche. */
  weekday: number;
  prefs: NotificationPrefs;
  mealTimes: Record<ReminderSlot, string>;
  loggedSlots: ReadonlySet<string>;
  waterGlasses: number;
  waterGoal: number;
  /** Le bilan de la semaine écoulée a assez de données pour être rédigé. */
  reviewReady: boolean;
  weekStart: string;
};

const within = (time: string, from: number, length: number) => {
  const now = minutesOf(time);
  return now >= from && now < from + length;
};

/**
 * Rappels dus à cet instant. Chacun a une clé : il n'est envoyé qu'une fois (le journal
 * des envois est consulté par l'appelant), même si la tâche passe plusieurs fois dans la fenêtre.
 */
export function dueReminders(input: ReminderInput): Reminder[] {
  const { prefs, time } = input;
  if (isQuiet(time, prefs.quietStart, prefs.quietEnd)) return [];
  const due: Reminder[] = [];
  if (prefs.meals) {
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      if (input.loggedSlots.has(slot)) continue;
      if (within(time, minutesOf(input.mealTimes[slot]) + MEAL_DELAY, MEAL_WINDOW - MEAL_DELAY)) {
        due.push({ kind: "meal", key: `${input.date}:${slot}`, slot });
      }
    }
  }
  if (prefs.water && input.waterGoal > 0) {
    // Seul le dernier point d'étape atteint compte : pas de rafale de rappels en retard.
    const checkpoint = WATER_CHECKPOINTS.findLast((point) => minutesOf(point.time) <= minutesOf(time));
    if (
      checkpoint &&
      within(time, minutesOf(checkpoint.time), WATER_WINDOW) &&
      input.waterGlasses < Math.round(input.waterGoal * checkpoint.share)
    ) {
      due.push({
        kind: "water",
        key: `${input.date}:${checkpoint.time}`,
        glasses: input.waterGlasses,
        goal: input.waterGoal,
      });
    }
  }
  if (
    prefs.weeklyReview &&
    input.reviewReady &&
    input.weekday === 1 &&
    within(time, minutesOf(REVIEW_FROM), minutesOf(REVIEW_UNTIL) - minutesOf(REVIEW_FROM))
  ) {
    due.push({ kind: "weekly_review", key: input.weekStart });
  }
  return due;
}
