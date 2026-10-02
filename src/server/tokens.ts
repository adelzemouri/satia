import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** Jeton aléatoire de 256 bits, sûr dans une URL. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
