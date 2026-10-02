import "server-only";

import { hash, verify } from "@node-rs/argon2";

/** Paramètres argon2id recommandés par l'OWASP (19 Mio, 2 itérations). */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword({ hash: digest, password }: { hash: string; password: string }): Promise<boolean> {
  return verify(digest, password).catch(() => false);
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
