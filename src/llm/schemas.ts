import { z } from "zod";

/** Sorties JSON attendues du LLM : courtes, validées par Zod avant tout usage. */

export const connectionTestSchema = z.object({ ok: z.boolean() });

/** Aliments reconnus sur une photo ou dans un texte : nom et quantité, jamais de valeurs nutritionnelles. */
export const mealItemsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        grams: z.number().positive().max(3000),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(15),
});

/** Valeurs moyennes pour 100 g, demandées seulement quand aucun aliment de la base ne correspond. */
export const foodEstimatesSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        kcal: z.number().min(0).max(900),
        proteinG: z.number().min(0).max(100),
        carbsG: z.number().min(0).max(100),
        fatG: z.number().min(0).max(100),
      }),
    )
    .max(15),
});

/** Réponse du coach dans le chat. */
export const coachReplySchema = z.object({ reply: z.string().trim().min(1).max(1500) });

/** Bilan hebdomadaire du coach. */
export const weeklyReviewSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  highlights: z.array(z.string().trim().min(1).max(240)).max(3),
  ideas: z.array(z.string().trim().min(1).max(240)).max(2),
});
