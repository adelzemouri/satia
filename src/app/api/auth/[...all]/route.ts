import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth";

const handler = toNextJsHandler((request: Request) => auth().handler(request));

export const { GET } = handler;

/**
 * Connexion, 2FA et changement de mot de passe passent par les actions serveur de l'app, qui
 * comptent les échecs par compte. Les routes HTTP équivalentes de Better Auth contourneraient ce
 * compteur : aucune écriture n'est acceptée ici.
 */
export function POST(): Response {
  return Response.json({ error: "not_found" }, { status: 404 });
}
