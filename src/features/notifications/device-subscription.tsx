"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { useErrorText } from "@/features/auth/use-error-text";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestNotificationAction } from "./actions";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function detectStatus(): Promise<Status> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

/** Abonnement de cet appareil aux notifications, et notification de test. */
export function DeviceSubscription({ publicKey, devices }: { publicKey: string | null; devices: number }) {
  const t = useTranslations("notifications");
  const errorText = useErrorText();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    detectStatus().then(setStatus, () => setStatus("off"));
  }, []);

  const fail = (error: string) => setMessage({ tone: "error", text: errorText(error) ?? "" });

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      if (!publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(publicKey),
          }));
        const json = subscription.toJSON();
        const result = await savePushSubscriptionAction({
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        });
        if (result?.error) return fail(result.error);
        setStatus("on");
        setMessage({ tone: "success", text: t("enabled") });
      } catch {
        fail("generic");
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const subscription = await currentSubscription();
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
        const result = await removePushSubscriptionAction(subscription.endpoint);
        if (result?.error) return fail(result.error);
      }
      setStatus("off");
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestNotificationAction();
      setMessage(
        result?.error
          ? { tone: "error", text: errorText(result.error) ?? "" }
          : { tone: "success", text: t("testSent") },
      );
    });

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{t("device")}</h3>
      <p className="text-sm text-text-muted">{t("devices", { count: devices })}</p>
      {!publicKey ? (
        <p>{t("notConfigured")}</p>
      ) : status === "unsupported" ? (
        <p>{t("unsupported")}</p>
      ) : status === "denied" ? (
        <p>{t("denied")}</p>
      ) : status === "on" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={test} disabled={pending}>
            {t("test")}
          </Button>
          <Button variant="ghost" onClick={disable} disabled={pending}>
            {t("disable")}
          </Button>
        </div>
      ) : (
        <Button onClick={enable} disabled={pending || status === "loading"}>
          {t("enable")}
        </Button>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
