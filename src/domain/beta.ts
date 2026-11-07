import { daysBetween } from "./adaptive";
import { addDays } from "./energy";

/** Nombre de jours montrés pour chaque invité de la bêta, aujourd'hui compris. */
export const BETA_WINDOW_DAYS = 28;
/** Un invité est « nouveau » sa première semaine, puis « actif » s'il a noté un repas ces 7 derniers jours. */
const ACTIVE_DAYS = 7;
/** Un invité « encore là après 3 semaines » : arrivé depuis au moins 21 jours et toujours actif. */
const RETAINED_AFTER_DAYS = 21;

export type BetaDay = "logged" | "empty" | "before";
export type BetaStatus = { kind: "new" } | { kind: "active" } | { kind: "idle"; days: number };

export type GuestActivity = {
  /** Les 28 derniers jours, du plus ancien à aujourd'hui ; « before » avant l'arrivée de l'invité. */
  days: BetaDay[];
  /** Jours avec au moins un repas noté, et jours possibles, dans la fenêtre. */
  logged: number;
  possible: number;
  lastLogged: string | null;
  joinedDaysAgo: number;
  /** Au moins un repas noté ces 7 derniers jours, aujourd'hui compris. */
  activeThisWeek: boolean;
  status: BetaStatus;
};

/**
 * Assiduité d'un invité à partir des seuls jours où il a noté un repas : jamais le contenu de
 * ses repas. `loggedDates` peut contenir des jours hors fenêtre (pour la dernière saisie).
 */
export function guestActivity(loggedDates: Iterable<string>, joinedOn: string, today: string): GuestActivity {
  const set = new Set(loggedDates);
  const start = addDays(today, -(BETA_WINDOW_DAYS - 1));
  const days: BetaDay[] = [];
  let logged = 0;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (day < joinedOn && !set.has(day)) days.push("before");
    else if (set.has(day)) {
      days.push("logged");
      logged += 1;
    } else days.push("empty");
  }
  const lastLogged =
    [...set]
      .filter((day) => day <= today)
      .sort()
      .at(-1) ?? null;
  const joinedDaysAgo = Math.max(0, daysBetween(joinedOn, today));
  const sinceLast = lastLogged ? daysBetween(lastLogged, today) : joinedDaysAgo;
  const activeThisWeek = lastLogged !== null && sinceLast < ACTIVE_DAYS;
  const status: BetaStatus =
    joinedDaysAgo < ACTIVE_DAYS
      ? { kind: "new" }
      : activeThisWeek
        ? { kind: "active" }
        : { kind: "idle", days: sinceLast };
  return {
    days,
    logged,
    possible: days.filter((day) => day !== "before").length,
    lastLogged,
    joinedDaysAgo,
    activeThisWeek,
    status,
  };
}

/** Les trois chiffres en tête : invités, actifs cette semaine, encore là après 3 semaines (sur combien). */
export function betaSummary(guests: GuestActivity[]) {
  const veterans = guests.filter((guest) => guest.joinedDaysAgo >= RETAINED_AFTER_DAYS);
  return {
    total: guests.length,
    active: guests.filter((guest) => guest.activeThisWeek).length,
    retained: veterans.filter((guest) => guest.activeThisWeek).length,
    veterans: veterans.length,
  };
}

/** Façons de noter un aliment, regroupées pour la fiche d'un invité. */
export const ENTRY_WAYS = ["photo", "search", "text", "barcode", "reuse"] as const;
export type EntryWay = (typeof ENTRY_WAYS)[number];

const WAY_OF: Record<string, EntryWay> = {
  photo: "photo",
  manual: "search",
  text: "text",
  voice: "text",
  barcode: "barcode",
  copy: "reuse",
  shared: "reuse",
};

export type EntryShare = { way: EntryWay; count: number; percent: number };

/**
 * Part de chaque façon de noter, de la plus utilisée à la moins utilisée (les absentes sont
 * omises). Les pourcentages arrondis font toujours 100 en tout.
 */
export function entryShares(countsByMethod: Iterable<{ method: string; count: number }>): EntryShare[] {
  const totals = new Map<EntryWay, number>();
  for (const { method, count } of countsByMethod) {
    const way = WAY_OF[method];
    if (way && count > 0) totals.set(way, (totals.get(way) ?? 0) + count);
  }
  const all = [...totals.values()].reduce((sum, count) => sum + count, 0);
  if (all === 0) return [];
  const shares = [...totals]
    .map(([way, count]) => ({ way, count, exact: (count * 100) / all }))
    .sort((a, b) => b.count - a.count || ENTRY_WAYS.indexOf(a.way) - ENTRY_WAYS.indexOf(b.way));
  // Plus grands restes : on arrondit vers le bas puis on distribue les points manquants.
  const floors = shares.map((share) => Math.floor(share.exact));
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = shares
    .map((share, index) => ({ index, remainder: share.exact - floors[index]! }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    floors[index]! += 1;
    missing -= 1;
  }
  return shares.map((share, index) => ({ way: share.way, count: share.count, percent: floors[index]! }));
}

export type GuestDevice = "iphone" | "android" | "computer";

/** Appareil d'après le navigateur de la dernière session (un iPad récent se dit Mac : « ordinateur »). */
export function deviceFromUserAgent(userAgent: string | null | undefined): GuestDevice | null {
  if (!userAgent) return null;
  if (/iPhone|iPod/i.test(userAgent)) return "iphone";
  if (/Android/i.test(userAgent)) return "android";
  return "computer";
}

/** Fonctions dont la fiche d'un invité dit s'il s'en sert (sur 28 jours). */
export const GUEST_FEATURES = ["coach", "menu", "fridge", "training"] as const;
export type GuestFeature = (typeof GUEST_FEATURES)[number];
