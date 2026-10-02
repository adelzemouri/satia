import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { buildContentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/server/security-headers";

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  // Next.js lit le nonce dans l'en-tête CSP de la requête pour l'appliquer à ses scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = intlMiddleware(request);
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|serwist|_next|_vercel|manifest.webmanifest|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
