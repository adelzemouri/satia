"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/button";

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Génère une paire de clés VAPID dans le navigateur (rien n'est envoyé au serveur) :
 * l'admin la colle dans les variables d'environnement de l'hébergeur.
 */
export function VapidKeys() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [keys, setKeys] = useState<{ VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    const publicKey = await crypto.subtle.exportKey("raw", pair.publicKey);
    const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
    setKeys({ VAPID_PUBLIC_KEY: base64url(publicKey), VAPID_PRIVATE_KEY: privateKey.d ?? "" });
    setCopied(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p>{t("pushMissing")}</p>
      {keys ? (
        <>
          {Object.entries(keys).map(([name, value]) => (
            <div key={name} className="flex flex-col gap-2 rounded-2xl bg-primary-soft p-4">
              <p className="font-semibold">{name}</p>
              <code className="rounded-lg bg-surface px-3 py-2 text-sm break-all">{value}</code>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(value);
                  setCopied(name);
                }}
              >
                {copied === name ? tc("copied") : tc("copy")}
              </Button>
            </div>
          ))}
          <p className="text-sm text-text-muted">{t("pushPrivateWarning")}</p>
        </>
      ) : (
        <Button variant="secondary" onClick={generate}>
          {t("pushGenerate")}
        </Button>
      )}
    </div>
  );
}
