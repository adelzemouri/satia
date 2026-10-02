import { z } from "zod";

/** Mots-clés compris par tous les fournisseurs ; les bornes restent vérifiées par Zod. */
const PORTABLE_KEYS = new Set(["type", "properties", "required", "items", "enum", "description", "anyOf"]);

function portable(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(portable);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => PORTABLE_KEYS.has(key))
      .map(([key, value]) =>
        key === "properties"
          ? [key, Object.fromEntries(Object.entries(value as object).map(([name, child]) => [name, portable(child)]))]
          : [key, portable(value)],
      ),
  );
}

/**
 * Schéma JSON envoyé au fournisseur, réduit à la structure (types, champs, listes) : certains
 * fournisseurs refusent `additionalProperties` ou les bornes numériques.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return portable(z.toJSONSchema(schema, { target: "draft-7" })) as Record<string, unknown>;
}

/** Lit un objet JSON dans une réponse texte, éventuellement entourée d'un bloc ```json. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1]! : trimmed);
}
