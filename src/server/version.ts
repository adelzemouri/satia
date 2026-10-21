import "server-only";

import { APP_MAJOR_VERSION, SOURCE_REPOSITORY_URL } from "@/config/app";
import { parseBuildNumber, versionLabel } from "@/domain/version";

/**
 * Version déployée : numéro lisible (« 1.196 »), code court du commit, adresse de ce commit sur
 * GitHub et date de mise en ligne.
 */
export function currentVersion(): {
  label: string | null;
  sha: string | null;
  commitUrl: string | null;
  builtAt: Date | null;
} {
  const rawSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA;
  const sha = rawSha ? rawSha.slice(0, 7) : null;
  const builtAt = process.env.APP_BUILT_AT ? new Date(process.env.APP_BUILT_AT) : null;
  return {
    label: versionLabel(APP_MAJOR_VERSION, parseBuildNumber(process.env.APP_BUILD_NUMBER), sha),
    sha,
    commitUrl: rawSha && /^[0-9a-f]{7,40}$/i.test(rawSha) ? `${SOURCE_REPOSITORY_URL}/commit/${rawSha}` : null,
    builtAt: builtAt && !Number.isNaN(builtAt.getTime()) ? builtAt : null,
  };
}
