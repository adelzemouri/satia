import "server-only";

import { eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";

import { db } from "@/db/client";
import { goals, profiles, user } from "@/db/schema";

/** Toutes les données personnelles d'un utilisateur, sans aucun secret (mots de passe, TOTP, sessions). */
export async function collectUserData(userId: string) {
  const [account] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locale: user.locale,
      energyUnit: user.energyUnit,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  const profileRows = await db().select().from(profiles).where(eq(profiles.userId, userId));
  const goalRows = await db().select().from(goals).where(eq(goals.userId, userId)).orderBy(goals.effectiveFrom);
  return {
    exportedAt: new Date().toISOString(),
    account: account ?? null,
    profile: profileRows[0] ?? null,
    goals: goalRows,
  };
}

export type UserData = Awaited<ReturnType<typeof collectUserData>>;

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text =
    value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  return (
    [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n"
  );
}

/** Archive ZIP contenant un CSV par jeu de données. */
export function toCsvZip(data: UserData): Uint8Array {
  return zipSync({
    "account.csv": strToU8(toCsv(data.account ? [data.account] : [])),
    "profile.csv": strToU8(toCsv(data.profile ? [data.profile] : [])),
    "goals.csv": strToU8(toCsv(data.goals)),
  });
}
