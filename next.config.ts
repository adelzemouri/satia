import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { API_CONTENT_SECURITY_POLICY, STATIC_SECURITY_HEADERS } from "./src/server/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Photo de repas réduite côté client (côté long ≤ 768 px) : quelques centaines de Ko au plus.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Le proxy ne voit pas /api : ses réponses reçoivent ici les mêmes en-têtes que les pages.
  headers: async () => [
    {
      source: "/api/:path*",
      headers: [
        ...Object.entries(STATIC_SECURITY_HEADERS).map(([key, value]) => ({ key, value })),
        { key: "Content-Security-Policy", value: API_CONTENT_SECURITY_POLICY },
      ],
    },
  ],
};

export default withSerwist(withNextIntl(nextConfig));
