import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

const url = "http://localhost/api/health";

describe("GET /api/health", () => {
  it("ne donne que l'état global en public", async () => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("donne le détail à l'appel signé du secret cron", async () => {
    const response = await GET(new Request(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      config: "ok",
      database: "ok",
      storage: "ok",
      llm: "disabled",
      timing: { region: "local", databaseMs: expect.any(Number) },
    });
    const wrong = await GET(new Request(url, { headers: { authorization: "Bearer autre" } }));
    expect(await wrong.json()).toEqual({ status: "ok" });
  });
});
