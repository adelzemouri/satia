import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Photo de repas réduite côté client (côté long ≤ 768 px) : quelques centaines de Ko au plus.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default withSerwist(withNextIntl(nextConfig));
