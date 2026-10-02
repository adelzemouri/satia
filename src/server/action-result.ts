import "server-only";

import { APIError } from "better-auth/api";
import { ZodError } from "zod";

import { DomainError } from "./errors";
import { RateLimitedError } from "./rate-limit";

/** Résultat d'une action serveur : un code d'erreur traduit côté client (`errors.*`). */
export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

export function toActionState(error: unknown): ActionState {
  if (error instanceof DomainError) return { error: error.code };
  if (error instanceof RateLimitedError) return { error: "rate_limited" };
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "invalid_form", fieldErrors };
  }
  if (error instanceof APIError) {
    if (error.status === "TOO_MANY_REQUESTS") return { error: "rate_limited" };
    if (error.status === "UNAUTHORIZED") return { error: "invalid_credentials" };
  }
  // Les redirections Next.js doivent être relancées, pas converties en erreur.
  throw error;
}
