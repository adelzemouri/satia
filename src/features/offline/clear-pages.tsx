"use client";

import { useEffect } from "react";

import { postToWorker } from "./service-worker";

/** Sur l'écran de connexion, plus aucune page d'un compte ne doit rester lisible hors ligne. */
export function ClearPages() {
  useEffect(() => postToWorker({ type: "clear-pages" }), []);
  return null;
}
