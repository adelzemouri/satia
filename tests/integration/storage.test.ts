import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { putObject, SIGNED_URL_TTL_SECONDS, signedGetUrl } from "@/server/storage";

describe("stockage objet", () => {
  it("le bucket est privé : lecture refusée sans signature", async () => {
    const key = `tests/${randomUUID()}.txt`;
    await putObject(key, new TextEncoder().encode("bonjour"), "text/plain");
    const url = new URL(await signedGetUrl(key));
    url.search = "";
    const response = await fetch(url);
    expect(response.status).toBe(403);
  });

  it("une URL signée courte permet de relire l'objet", async () => {
    const key = `tests/${randomUUID()}.txt`;
    await putObject(key, new TextEncoder().encode("bonjour"), "text/plain");
    const url = await signedGetUrl(key);
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe(String(SIGNED_URL_TTL_SECONDS));
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("bonjour");
  });
});
