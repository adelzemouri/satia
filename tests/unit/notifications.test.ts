import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_PREFS,
  dueReminders,
  isQuiet,
  localClock,
  type ReminderInput,
} from "@/domain/notifications";

const base: ReminderInput = {
  date: "2026-10-26",
  time: "12:00",
  weekday: 1,
  weekStart: "2026-10-26",
  prefs: DEFAULT_NOTIFICATION_PREFS,
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "19:30" },
  loggedSlots: new Set(),
  waterGlasses: 8,
  waterGoal: 8,
  reviewReady: false,
};
const at = (time: string, extra: Partial<ReminderInput> = {}) => dueReminders({ ...base, time, ...extra });

describe("plage silencieuse", () => {
  it("gère une plage qui passe minuit", () => {
    expect(isQuiet("23:10", "22:00", "07:30")).toBe(true);
    expect(isQuiet("06:59", "22:00", "07:30")).toBe(true);
    expect(isQuiet("07:30", "22:00", "07:30")).toBe(false);
    expect(isQuiet("13:00", "12:00", "14:00")).toBe(true);
    expect(isQuiet("13:00", "08:00", "08:00")).toBe(false);
  });

  it("ne laisse partir aucun rappel", () => {
    expect(at("08:00", { prefs: { ...DEFAULT_NOTIFICATION_PREFS, quietEnd: "09:00" } })).toEqual([]);
  });
});

describe("rappels de repas", () => {
  it("part 30 min après l'horaire habituel, tant que le repas n'est pas noté, pendant 2 h 30", () => {
    expect(at("12:45")).toEqual([]);
    expect(at("13:00")).toEqual([{ kind: "meal", key: "2026-10-26:lunch", slot: "lunch" }]);
    expect(at("15:29")).toEqual([{ kind: "meal", key: "2026-10-26:lunch", slot: "lunch" }]);
    expect(at("15:30")).toEqual([]);
    expect(at("13:00", { loggedSlots: new Set(["lunch"]) })).toEqual([]);
  });

  it("se désactive avec la préférence", () => {
    expect(at("13:00", { prefs: { ...DEFAULT_NOTIFICATION_PREFS, meals: false } })).toEqual([]);
  });
});

describe("rappels d'hydratation", () => {
  it("compare au point d'étape atteint, sans rattraper les précédents", () => {
    expect(at("11:15", { waterGlasses: 1 })).toEqual([{ kind: "water", key: "2026-10-26:11:00", glasses: 1, goal: 8 }]);
    expect(at("11:15", { waterGlasses: 2 })).toEqual([]);
    expect(at("15:30", { waterGlasses: 4, loggedSlots: new Set(["lunch"]) })).toEqual([
      { kind: "water", key: "2026-10-26:15:00", glasses: 4, goal: 8 },
    ]);
    // Hors de la fenêtre de 2 h après le point d'étape.
    expect(at("17:30", { waterGlasses: 0 })).toEqual([]);
  });
});

describe("bilan de la semaine", () => {
  it("est annoncé le lundi matin quand il est prêt", () => {
    expect(at("09:30", { reviewReady: true, loggedSlots: new Set(["breakfast"]) })).toEqual([
      { kind: "weekly_review", key: "2026-10-26" },
    ]);
    expect(at("09:30", { reviewReady: false, loggedSlots: new Set(["breakfast"]) })).toEqual([]);
    expect(at("09:30", { reviewReady: true, weekday: 2, loggedSlots: new Set(["breakfast"]) })).toEqual([]);
    expect(at("14:00", { reviewReady: true, loggedSlots: new Set(["lunch"]) })).toEqual([]);
  });
});

describe("horloge locale", () => {
  it("donne la date, l'heure et le jour à Paris", () => {
    expect(localClock(new Date("2026-10-25T23:30:00Z"), "Europe/Paris")).toEqual({
      date: "2026-10-26",
      time: "00:30",
      weekday: 1,
    });
  });
});

describe("clés VAPID générées dans le navigateur", () => {
  it("ont le format attendu par l'envoi Web Push", async () => {
    const { default: webpush } = await import("web-push");
    const toBase64url = (bytes: ArrayBuffer) => Buffer.from(bytes).toString("base64url");
    // Même procédé que la page admin (WebCrypto).
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    const publicKey = toBase64url(await crypto.subtle.exportKey("raw", pair.publicKey));
    const privateKey = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!;
    expect(() => webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey)).not.toThrow();

    // Un abonnement de navigateur factice : la requête chiffrée et signée se construit.
    const browser = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const details = webpush.generateRequestDetails(
      {
        endpoint: "https://push.example.com/abc",
        keys: {
          p256dh: toBase64url(await crypto.subtle.exportKey("raw", browser.publicKey)),
          auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
        },
      },
      JSON.stringify({ title: "Test" }),
      { vapidDetails: { subject: "mailto:admin@example.com", publicKey, privateKey } },
    );
    expect(details.headers.Authorization).toMatch(/^vapid t=/);
  });
});
