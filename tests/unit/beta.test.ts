import { describe, expect, it } from "vitest";

import { betaSummary, deviceFromUserAgent, entryShares, guestActivity } from "@/domain/beta";

const TODAY = "2026-10-18";

describe("guestActivity", () => {
  it("montre 28 jours, aujourd'hui à droite, et compte les jours notés", () => {
    const activity = guestActivity(["2026-10-18", "2026-10-17", "2026-09-21", "2026-09-20"], "2026-09-01", TODAY);
    expect(activity.days).toHaveLength(28);
    expect(activity.days.at(-1)).toBe("logged");
    expect(activity.days[0]).toBe("logged"); // 21/09 est le premier jour de la fenêtre
    expect(activity.logged).toBe(3); // le 20/09 est hors fenêtre
    expect(activity.possible).toBe(28);
    expect(activity.lastLogged).toBe(TODAY);
    expect(activity.status).toEqual({ kind: "active" });
  });

  it("grise les jours d'avant l'arrivée et dit « nouveau » la première semaine", () => {
    const activity = guestActivity(["2026-10-16"], "2026-10-15", TODAY);
    expect(activity.days.filter((day) => day === "before")).toHaveLength(24);
    expect(activity.possible).toBe(4);
    expect(activity.status).toEqual({ kind: "new" });
    expect(activity.activeThisWeek).toBe(true);
  });

  it("compte les jours sans saisie depuis la dernière, ou depuis l'arrivée s'il n'a rien noté", () => {
    expect(guestActivity(["2026-10-09"], "2026-09-25", TODAY).status).toEqual({ kind: "idle", days: 9 });
    expect(guestActivity([], "2026-10-08", TODAY).status).toEqual({ kind: "idle", days: 10 });
    // Sept jours pile sans rien : plus actif.
    expect(guestActivity(["2026-10-11"], "2026-09-25", TODAY).status).toEqual({ kind: "idle", days: 7 });
    expect(guestActivity(["2026-10-12"], "2026-09-25", TODAY).status).toEqual({ kind: "active" });
  });
});

describe("betaSummary", () => {
  it("compte les invités actifs, et ceux encore là après trois semaines parmi les anciens", () => {
    const summary = betaSummary([
      guestActivity([TODAY], "2026-09-20", TODAY), // ancien, actif
      guestActivity(["2026-10-01"], "2026-09-22", TODAY), // ancien, parti
      guestActivity([TODAY], "2026-10-10", TODAY), // récent, actif
      guestActivity([], "2026-10-16", TODAY), // nouveau, rien encore
    ]);
    expect(summary).toEqual({ total: 4, active: 2, retained: 1, veterans: 2 });
  });
});

describe("entryShares", () => {
  it("regroupe les façons de noter et fait toujours 100 % en tout", () => {
    const shares = entryShares([
      { method: "manual", count: 17 },
      { method: "photo", count: 8 },
      { method: "voice", count: 2 },
      { method: "text", count: 2 },
      { method: "barcode", count: 2 },
    ]);
    expect(shares.map((share) => share.way)).toEqual(["search", "photo", "text", "barcode"]);
    expect(shares.find((share) => share.way === "text")?.count).toBe(4);
    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
  });

  it("met la copie d'un repas et les plats partagés ensemble, et rend une liste vide sans saisie", () => {
    expect(
      entryShares([
        { method: "copy", count: 1 },
        { method: "shared", count: 1 },
      ]),
    ).toEqual([{ way: "reuse", count: 2, percent: 100 }]);
    expect(entryShares([])).toEqual([]);
  });

  it("répartit les restes des arrondis sur les plus grandes parts", () => {
    const shares = entryShares([
      { method: "photo", count: 1 },
      { method: "manual", count: 1 },
      { method: "barcode", count: 1 },
    ]);
    expect(shares.map((share) => share.percent)).toEqual([34, 33, 33]);
  });
});

describe("deviceFromUserAgent", () => {
  it("reconnaît iPhone, Android et ordinateur", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iphone");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("computer");
    expect(deviceFromUserAgent(null)).toBeNull();
  });
});
