import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { readBuildInfo } from "./src/config/build-info";
import { API_CONTENT_SECURITY_POLICY, STATIC_SECURITY_HEADERS } from "./src/server/security-headers";

const build = readBuildInfo();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Numéro de version affiché en bas de Moi, figé au build (voir src/config/build-info.ts).
  env: { APP_BUILD_NUMBER: build.buildNumber, APP_BUILT_AT: build.builtAt },
  // Photo de repas réduite côté client (côté long ≤ 768 px) : quelques centaines de Ko au plus.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Le proxy ne voit pas /api : ses réponses reçoivent ici les mêmes en-têtes que les pages.
  headers: async () => [
    // Photos du catalogue : sans cela, Vercel les sert avec `max-age=0` et le navigateur redemande
    // chaque photo à chaque visite. Une semaine : une photo retouchée sous le même nom finit par passer.
    {
      // Fichiers .webp seulement : `:path*` toucherait aussi la page /recipes elle-même.
      source: "/recipes/:file(.+\\.webp)",
      headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }],
    },
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
