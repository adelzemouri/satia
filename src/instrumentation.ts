import type { Instrumentation } from "next";

/**
 * Erreurs du rendu serveur : en production, le navigateur n'en voit que le `digest`. On garde
 * le vrai message en base pour le retrouver depuis un bug signalé (voir server-errors.ts).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordServerError } = await import("./server/server-errors");
    await recordServerError(error, request.path);
  } catch (failure) {
    // La base elle-même peut être la cause : le message reste dans les journaux de l'hébergeur.
    console.error("Erreur serveur non enregistrée", failure);
  }
};
