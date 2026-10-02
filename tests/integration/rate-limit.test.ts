import { beforeEach, describe, expect, it } from "vitest";

import { assertBelowLimit, consumeRateLimit, enforceRateLimit } from "@/server/rate-limit";

import { resetDatabase } from "./helpers";

describe("limitation de débit", () => {
  beforeEach(resetDatabase);

  it("autorise jusqu'au maximum puis bloque avec un délai", async () => {
    const rule = { window: 60, max: 3 };
    for (let i = 0; i < 3; i++) expect((await consumeRateLimit("k", rule)).allowed).toBe(true);
    const blocked = await consumeRateLimit("k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    await expect(enforceRateLimit("k", rule)).rejects.toThrow("rate_limited");
    expect((await consumeRateLimit("autre", rule)).allowed).toBe(true);
  });

  it("reste exact sous requêtes concurrentes", async () => {
    const rule = { window: 60, max: 5 };
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit("c", rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("repart à zéro après la fenêtre", async () => {
    const rule = { window: 1, max: 1 };
    expect((await consumeRateLimit("w", rule)).allowed).toBe(true);
    expect((await consumeRateLimit("w", rule)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await consumeRateLimit("w", rule)).allowed).toBe(true);
  });
});

describe("assertBelowLimit", () => {
  beforeEach(resetDatabase);

  it("ne compte rien mais bloque une fois la limite atteinte", async () => {
    const rule = { window: 60, max: 2 };
    await assertBelowLimit("f", rule);
    await assertBelowLimit("f", rule);
    await consumeRateLimit("f", rule);
    await assertBelowLimit("f", rule);
    await consumeRateLimit("f", rule);
    await expect(assertBelowLimit("f", rule)).rejects.toThrow("rate_limited");
  });
});
