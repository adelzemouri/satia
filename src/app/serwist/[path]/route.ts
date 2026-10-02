import { createSerwistRoute } from "@serwist/turbopack";

// Vercel expose le SHA du commit ; en local on retombe sur une valeur stable par build.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
