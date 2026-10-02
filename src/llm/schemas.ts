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
