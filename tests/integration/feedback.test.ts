import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { feedbackMessages, pushSubscriptions, user } from "@/db/schema";
import { acceptInvite, createAccessLink, deleteUser, setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import {
  feedbackRecipient,
  listFeedback,
  purgeFeedbackScreenshots,
  sendFeedback,
  setFeedbackHandled,
  unreadFeedbackCount,
} from "@/server/feedback";
import { setPushSenderForTests } from "@/server/notifications";

import { resetDatabase } from "./helpers";

const JPEG_BASE64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/604.1";
const context = { userAgent: IPHONE, origin: "http://localhost:3000" };

async function setup() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [admin] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  const token = await createAccessLink({
    kind: "invite",
    householdId: admin!.householdId,
    createdBy: admin!.id,
    role: "member",
    label: "Camille",
    separateHousehold: true,
  });
  await acceptInvite({ token, name: "Camille", email: "camille@example.com", password: "mot-de-passe-camille" });
  const [guest] = await db().select().from(user).where(eq(user.email, "camille@example.com"));
  return { admin: admin!, guest: guest! };
}

describe("remarques et bugs", () => {
  beforeEach(resetDatabase);
  afterEach(() => setPushSenderForTests(null));

  it("un invité de la bêta écrit à l'admin qui gère son foyer, qui est prévenu", async () => {
    const { admin, guest } = await setup();
    const pushes: { title: string; url: string }[] = [];
    setPushSenderForTests(async (_subscription, payload) => {
      pushes.push(payload);
      return 201;
    });
    await db()
      .insert(pushSubscriptions)
      .values({ userId: admin.id, endpoint: "https://push.example/adel", p256dh: "k", auth: "a" });

    expect(await feedbackRecipient(guest.id)).toEqual({ id: admin.id, name: "Adel" });
    await sendFeedback(
      guest.id,
      {
        kind: "bug",
        message: "  La banane du goûter apparaît au déjeuner.  ",
        page: "/journal?date=2026-10-20",
        screenshot: { base64: JPEG_BASE64, mime: "image/jpeg" },
      },
      context,
    );

    expect(pushes).toEqual([expect.objectContaining({ title: "Bug signalé par Camille", url: "/admin#remarques" })]);
    const [item] = await listFeedback(admin.householdId);
    expect(item).toMatchObject({
      kind: "bug",
      message: "La banane du goûter apparaît au déjeuner.",
      senderName: "Camille",
      page: "/journal",
      userAgent: IPHONE,
      handled: false,
    });
    expect(item!.screenshotUrl).toMatch(/^http/);
    // Le foyer à part de l'invité ne voit rien.
    expect(await listFeedback(guest.householdId)).toEqual([]);
    expect(await unreadFeedbackCount(admin.householdId)).toBe(1);

    await expect(setFeedbackHandled(guest.householdId, item!.id, true)).rejects.toThrow("not_found");
    await setFeedbackHandled(admin.householdId, item!.id, true);
    expect(await unreadFeedbackCount(admin.householdId)).toBe(0);
    expect((await listFeedback(admin.householdId))[0]!.handled).toBe(true);
  });

  it("refuse un message vide ou une capture qui n'est pas une image", async () => {
    const { guest } = await setup();
    await expect(sendFeedback(guest.id, { kind: "remark", message: "   " }, context)).rejects.toThrow();
    await expect(
      sendFeedback(
        guest.id,
        {
          kind: "remark",
          message: "Coucou",
          screenshot: { base64: Buffer.from("pas une image").toString("base64"), mime: "image/jpeg" },
        },
        context,
      ),
    ).rejects.toThrow("invalid_photo");
  });

  it("purge les captures anciennes, exporte les messages et les supprime avec le compte", async () => {
    const { admin, guest } = await setup();
    await sendFeedback(
      guest.id,
      { kind: "remark", message: "Le thème sombre est top.", screenshot: { base64: JPEG_BASE64, mime: "image/jpeg" } },
      context,
    );
    expect(await purgeFeedbackScreenshots()).toBe(0);
    expect(await purgeFeedbackScreenshots(new Date(Date.now() + 91 * 86_400_000))).toBe(1);
    const [item] = await listFeedback(admin.householdId);
    expect(item).toMatchObject({ message: "Le thème sombre est top.", screenshotUrl: null });

    const data = await collectUserData(guest.id);
    expect(data.feedback).toEqual([expect.objectContaining({ kind: "remark", message: "Le thème sombre est top." })]);

    await deleteUser(guest.id);
    expect(await db().select().from(feedbackMessages)).toEqual([]);
  });
});
