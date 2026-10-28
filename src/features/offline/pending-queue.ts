import type { MealSlot } from "@/domain/meals";
import type { Unit } from "@/domain/units";

/** Aliment noté sans réseau, envoyé au journal dès que la connexion revient. */
export type PendingEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  foodId: string;
  quantity: number;
  unit: Unit;
  inputMethod: "manual" | "barcode";
  /** Pour l'affichage en attendant l'envoi. */
  label: string;
  kcal: number;
  /** Code d'erreur renvoyé par le serveur (aliment supprimé…) : l'entrée n'est plus renvoyée. */
  error?: string;
};

const CHANGE_EVENT = "pommelia:pending-entries";
const EMPTY: readonly PendingEntry[] = [];

/** Une file par compte : un autre membre connecté sur le même téléphone ne l'envoie jamais. */
const keyFor = (userId: string) => `pommelia.pending-entries.${userId}`;

let cache: { raw: string | null; entries: readonly PendingEntry[] } = { raw: null, entries: EMPTY };

export function readPending(userId: string): readonly PendingEntry[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(keyFor(userId));
  } catch {
    return EMPTY;
  }
  // Même texte, même tableau : `useSyncExternalStore` exige un instantané stable.
  if (raw === cache.raw) return cache.entries;
  let entries: readonly PendingEntry[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) entries = parsed as PendingEntry[];
  } catch {
    entries = EMPTY;
  }
  cache = { raw, entries };
  return entries;
}

function write(userId: string, entries: readonly PendingEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(keyFor(userId));
    else localStorage.setItem(keyFor(userId), JSON.stringify(entries));
  } finally {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function addPending(userId: string, entry: Omit<PendingEntry, "id">): void {
  write(userId, [...readPending(userId), { ...entry, id: crypto.randomUUID() }]);
}

export function removePending(userId: string, id: string): void {
  write(
    userId,
    readPending(userId).filter((entry) => entry.id !== id),
  );
}

export function markPendingFailed(userId: string, id: string, error: string): void {
  write(
    userId,
    readPending(userId).map((entry) => (entry.id === id ? { ...entry, error } : entry)),
  );
}

export function subscribePending(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
