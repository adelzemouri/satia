import { describe, expect, it } from "vitest";

import { isNetworkFailure, withNetworkFallback } from "@/ui/network-failure";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; url?: string } | null;

describe("withNetworkFallback", () => {
  it("rend le résultat de l'action quand tout va bien", async () => {
    const action = withNetworkFallback(async (_state: State, label: string): Promise<State> => ({ url: label }));
    expect(await action(null, "lien")).toEqual({ url: "lien" });
  });

  it("change une coupure réseau (Safari : « Load failed ») en erreur du formulaire", async () => {
    const action = withNetworkFallback(async (): Promise<State> => {
      throw new TypeError("Load failed");
    });
    expect(await action({ ok: true, url: "ancien", fieldErrors: { label: "required" } })).toEqual({
      ok: undefined,
      url: "ancien",
      error: "network",
      fieldErrors: undefined,
    });
    expect(await action(null)).toMatchObject({ error: "network" });
  });

  it("laisse passer les autres erreurs, dont les redirections de Next.js", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
    const action = withNetworkFallback(async (): Promise<State> => {
      throw redirect;
    });
    await expect(action(null)).rejects.toBe(redirect);
  });
});

describe("isNetworkFailure", () => {
  it("reconnaît les échecs de fetch de Safari et de Chrome", () => {
    expect(isNetworkFailure(new TypeError("Load failed"))).toBe(true);
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("boom"))).toBe(false);
  });
});
