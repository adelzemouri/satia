import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/server/security-headers";

describe("buildContentSecurityPolicy", () => {
  it("autorise uniquement les scripts portant le nonce en production", () => {
    const csp = buildContentSecurityPolicy("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("autorise eval en développement seulement", () => {
    expect(buildContentSecurityPolicy("abc", true)).toContain("'unsafe-eval'");
  });
});
