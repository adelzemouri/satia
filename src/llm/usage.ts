import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { APP_TIMEZONE } from "@/config/app";
import { db } from "@/db/client";
import { type LlmCallStatus, type LlmFeature, llmCalls, user } from "@/db/schema";

/** Fuseau en littéral SQL (constante de l'app) : le GROUP BY doit voir des expressions identiques. */
const tz = sql.raw(`'${APP_TIMEZONE}'`);

/** Début du mois en cours, à l'heure de Paris. */
const monthStart = sql`(date_trunc('month', now() at time zone ${tz}) at time zone ${tz})`;

export async function recordCall(call: {
  userId: string | null;
  feature: LlmFeature;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsdMicros: number;
  latencyMs: number;
  status: LlmCallStatus;
}): Promise<void> {
  await db().insert(llmCalls).values(call);
}

/** Coût cumulé du mois en cours, tous utilisateurs confondus. */
export async function currentMonthCostMicros(): Promise<number> {
  const [row] = await db()
    .select({ total: sql<string | null>`sum(${llmCalls.costUsdMicros})` })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, monthStart));
  return Number(row?.total ?? 0);
}

export type MonthlyUserCost = {
  month: string;
  userId: string | null;
  name: string | null;
  calls: number;
  failures: number;
  tokensIn: number;
  tokensOut: number;
  costUsdMicros: number;
};

/** Coûts par mois et par utilisateur, du plus récent au plus ancien (12 derniers mois). */
export async function monthlyCosts(): Promise<MonthlyUserCost[]> {
  const month = sql<string>`to_char(${llmCalls.createdAt} at time zone ${tz}, 'YYYY-MM')`;
  const rows = await db()
    .select({
      month,
      userId: llmCalls.userId,
      name: user.name,
      calls: sql<string>`count(*)`,
      failures: sql<string>`count(*) filter (where ${llmCalls.status} <> 'ok')`,
      tokensIn: sql<string>`sum(${llmCalls.tokensIn})`,
      tokensOut: sql<string>`sum(${llmCalls.tokensOut})`,
      costUsdMicros: sql<string>`sum(${llmCalls.costUsdMicros})`,
    })
    .from(llmCalls)
    .leftJoin(user, eq(user.id, llmCalls.userId))
    .where(and(gte(llmCalls.createdAt, sql`${monthStart} - interval '11 months'`)))
    .groupBy(month, llmCalls.userId, user.name)
    .orderBy(desc(month), desc(sql`sum(${llmCalls.costUsdMicros})`));
  return rows.map((row) => ({
    month: row.month,
    userId: row.userId,
    name: row.name,
    calls: Number(row.calls),
    failures: Number(row.failures),
    tokensIn: Number(row.tokensIn),
    tokensOut: Number(row.tokensOut),
    costUsdMicros: Number(row.costUsdMicros),
  }));
}
