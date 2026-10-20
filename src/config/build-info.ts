import { execFileSync } from "node:child_process";

/**
 * Lu une seule fois au build (next.config.ts) : nombre de commits de la branche déployée et
 * heure du build. Vercel clone le dépôt en partie seulement ; on récupère alors l'historique
 * complet avant de compter. Si quoi que ce soit échoue, on renvoie null et l'app affiche le
 * code court du commit à la place : jamais de build cassé pour un numéro de version.
 */
export function readBuildInfo(): { buildNumber: string; builtAt: string } {
  return { buildNumber: countCommits()?.toString() ?? "", builtAt: new Date().toISOString() };
}

function git(args: string[], timeout = 5000): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout }).trim();
}

function countCommits(): number | null {
  try {
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
      // Seulement sur Vercel : en CI ou ailleurs, on ne télécharge pas l'historique pour rien.
      if (!process.env.VERCEL) return null;
      const owner = process.env.VERCEL_GIT_REPO_OWNER;
      const slug = process.env.VERCEL_GIT_REPO_SLUG;
      const remote = owner && slug ? `https://github.com/${owner}/${slug}.git` : "origin";
      git(["fetch", "--quiet", "--unshallow", remote, "HEAD"], 60_000);
      if (git(["rev-parse", "--is-shallow-repository"]) === "true") return null;
    }
    const count = Number(git(["rev-list", "--count", "HEAD"]));
    return Number.isInteger(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}
