/**
 * Moment de la journée, pour la lueur douce en haut de page (abricot le matin, vert tendre à midi,
 * prune le soir). Calculé sur l'heure de l'appareil, pour suivre la personne où qu'elle soit.
 */
export type DayMoment = "matin" | "midi" | "soir";

/** Le matin commence à 5 h, midi à 11 h, le soir à 17 h (la nuit garde la lueur du soir). */
export const MOMENT_HOURS = { matin: 5, midi: 11, soir: 17 } as const;

export function dayMoment(hour: number): DayMoment {
  if (hour >= MOMENT_HOURS.matin && hour < MOMENT_HOURS.midi) return "matin";
  if (hour >= MOMENT_HOURS.midi && hour < MOMENT_HOURS.soir) return "midi";
  return "soir";
}

/**
 * Script en ligne du <head> : pose `data-moment` sur <html> avant le premier affichage (pas de
 * changement de couleur visible), puis le remet à jour quand l'app revient au premier plan.
 */
export const DAY_MOMENT_SCRIPT = `(function(){var d=document.documentElement;function s(){var h=new Date().getHours();d.setAttribute("data-moment",h>=${MOMENT_HOURS.matin}&&h<${MOMENT_HOURS.midi}?"matin":h>=${MOMENT_HOURS.midi}&&h<${MOMENT_HOURS.soir}?"midi":"soir")}s();document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")s()})})();`;
