import https from "node:https";
import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

// Le correctif patches/web-push@3.6.7.patch remplace url.parse() (avertissement
// DEP0169 dans les logs de prod) par new URL(). Ces tests vérifient que la
// requête envoyée au service push reste identique.

const keys = webpush.generateVAPIDKeys();
const subscription = {
  endpoint: "https://push.example.test:8443/wpush/v2/abc?x=1",
  keys: {
    p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
  },
};

function decodeAudience(authorization: string): string {
  const jwt = authorization.replace(/^vapid t=/, "").split(",")[0]!;
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
    aud: string;
  };
  return payload.aud;
}

afterEach(() => vi.restoreAllMocks());

describe("web-push corrigé", () => {
  it("garde l'origine de l'endpoint comme audience VAPID", () => {
    const details = webpush.generateRequestDetails(subscription, "coucou", {
      vapidDetails: { subject: "mailto:test@example.test", ...keys },
    });
    expect(decodeAudience(details.headers.Authorization as string)).toBe("https://push.example.test:8443");
  });

  it("envoie vers le bon hôte, port et chemin sans avertissement url.parse", async () => {
    const warn = vi.spyOn(process, "emitWarning");
    const request = vi.spyOn(https, "request").mockImplementation(((
      _options: https.RequestOptions,
      callback: (res: EventEmitter & { statusCode: number; headers: object }) => void,
    ) => {
      const req = Object.assign(new EventEmitter(), {
        write: () => true,
        end: () => {
          const res = Object.assign(new EventEmitter(), { statusCode: 201, headers: {} });
          callback(res);
          res.emit("end");
        },
      });
      return req;
    }) as unknown as typeof https.request);

    await webpush.sendNotification(subscription, "coucou", {
      vapidDetails: { subject: "mailto:test@example.test", ...keys },
    });

    const options = request.mock.calls[0]![0] as https.RequestOptions;
    expect(options.hostname).toBe("push.example.test");
    expect(options.port).toBe("8443");
    expect(options.path).toBe("/wpush/v2/abc?x=1");
    expect(warn.mock.calls.some((c) => String(c[0]).includes("url.parse"))).toBe(false);
  });
});
