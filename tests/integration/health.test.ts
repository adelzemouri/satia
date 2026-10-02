import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("répond ok quand la base et le stockage sont joignables", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      config: "ok",
      database: "ok",
      storage: "ok",
      llm: "disabled",
      timing: { region: "local", databaseMs: expect.any(Number) },
    });
  });
});
