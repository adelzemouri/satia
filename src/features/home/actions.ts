"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import {
  parseSnoozes,
  RITUAL_KINDS,
  type RitualKind,
  serializeSnoozes,
  SNOOZE_COOKIE,
  SNOOZE_DAYS,
} from "@/domain/rituals";
import { getCurrentUser } from "@/server/session";

/** « Plus tard » sur un rituel : masqué sur cet appareil jusqu'à demain (pesée) ou une semaine. */
export async function snoozeRitualAction(kind: RitualKind): Promise<void> {
  if (!(RITUAL_KINDS as readonly string[]).includes(kind) || !(await getCurrentUser())) return;
  const today = todayIso();
  const jar = await cookies();
  const snoozes = { ...parseSnoozes(jar.get(SNOOZE_COOKIE)?.value), [kind]: addDays(today, SNOOZE_DAYS[kind]) };
  jar.set(SNOOZE_COOKIE, serializeSnoozes(snoozes, today), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 10,
  });
  revalidatePath("/[locale]", "layout");
}
