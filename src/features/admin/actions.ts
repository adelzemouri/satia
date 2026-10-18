"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";

import { ROLES } from "@/db/schema";
import { getPathname } from "@/i18n/navigation";
import {
  assertManagedUser,
  createAccessLink,
  deleteGuestHouseholdIfEmpty,
  deleteUser,
  revokeInvite,
} from "@/server/accounts";
import { type ActionState, toActionState } from "@/server/action-result";
import { deleteDemoAccount, fillDemoGaps, resetDemoAccount } from "@/server/demo";
import { DomainError } from "@/server/errors";
import { publicOrigin } from "@/server/request";
import { type CurrentUser, getCurrentUser } from "@/server/session";
import { calorieFloorsSchema, setCalorieFloors } from "@/server/settings";

export type LinkState = (ActionState & { url?: string }) | null;

async function requireAdminUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new DomainError("not_found");
  return user;
}

async function linkUrl(kind: "invite" | "reset", token: string): Promise<string> {
  const path = getPathname({ href: `/${kind}/${token}`, locale: await getLocale() });
  return `${await publicOrigin()}${path}`;
}

const inviteInput = z.object({
  label: z.string().trim().min(1, "required").max(40),
  role: z.enum(ROLES),
  where: z.enum(["household", "separate"]).default("household"),
});

export async function createInviteAction(_prev: LinkState, formData: FormData): Promise<LinkState> {
  try {
    const admin = await requireAdminUser();
    const { where, ...input } = inviteInput.parse({
      label: formData.get("label"),
      role: formData.get("role") ?? "member",
      where: formData.get("where") ?? undefined,
    });
    const token = await createAccessLink({
      kind: "invite",
      householdId: admin.householdId,
      createdBy: admin.id,
      ...input,
      separateHousehold: where === "separate",
    });
    revalidatePath("/[locale]/admin", "page");
    return { url: await linkUrl("invite", token) };
  } catch (error) {
    return toActionState(error);
  }
}

export async function createResetLinkAction(userId: string): Promise<LinkState> {
  try {
    const admin = await requireAdminUser();
    await assertManagedUser(admin.householdId, userId);
    const token = await createAccessLink({
      kind: "password_reset",
      householdId: admin.householdId,
      createdBy: admin.id,
      userId,
    });
    return { url: await linkUrl("reset", token) };
  } catch (error) {
    return toActionState(error);
  }
}

export async function revokeInviteAction(linkId: string): Promise<void> {
  const admin = await requireAdminUser();
  await revokeInvite(admin.householdId, linkId);
  revalidatePath("/[locale]/admin", "page");
}

export async function removeMemberAction(userId: string): Promise<ActionState> {
  try {
    const admin = await requireAdminUser();
    if (userId === admin.id) throw new DomainError("not_found");
    const { guestHouseholdId } = await assertManagedUser(admin.householdId, userId);
    await deleteUser(userId);
    if (guestHouseholdId) await deleteGuestHouseholdIfEmpty(guestHouseholdId);
    revalidatePath("/[locale]/admin", "page");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function saveFloorsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdminUser();
    const floors = calorieFloorsSchema.parse({
      female: Number(formData.get("female")),
      male: Number(formData.get("male")),
    });
    await setCalorieFloors(floors);
    revalidatePath("/[locale]/admin", "page");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export type DemoState =
  (ActionState & { email?: string; password?: string; loginUrl?: string; filledDays?: number }) | null;

/** (Re)crée le compte démo : nouvelles données et nouveau mot de passe, à transmettre au visiteur. */
export async function resetDemoAction(): Promise<DemoState> {
  try {
    await requireAdminUser();
    const credentials = await resetDemoAccount();
    revalidatePath("/[locale]/admin", "page");
    const path = getPathname({ href: "/login", locale: await getLocale() });
    return { ...credentials, loginUrl: `${await publicOrigin()}${path}` };
  } catch (error) {
    return toActionState(error);
  }
}

/** Remplit les jours sans repas du compte démo, sans effacer ni changer le mot de passe. */
export async function fillDemoAction(): Promise<DemoState> {
  try {
    await requireAdminUser();
    const { days } = await fillDemoGaps();
    return { ok: true, filledDays: days };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteDemoAction(): Promise<ActionState> {
  try {
    await requireAdminUser();
    await deleteDemoAccount();
    revalidatePath("/[locale]/admin", "page");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
