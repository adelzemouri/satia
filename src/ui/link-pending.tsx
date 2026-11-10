"use client";

import { useLinkStatus } from "next/link";

/**
 * À placer dans un lien (dont le parent est `relative`) : tant que la page demandée n'est pas
 * arrivée, un trait se remplit en bas du lien et la ligne `press-row` reste foncée. Le doigt voit
 * tout de suite que le toucher a pris, même quand le serveur met un peu de temps à répondre.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" data-link-pending="" className="link-pending" /> : null;
}
