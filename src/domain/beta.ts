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
