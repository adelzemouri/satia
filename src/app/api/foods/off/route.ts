import { ZodError } from "zod";

import { DomainError } from "@/server/errors";
import { searchOpenFoodFacts } from "@/server/open-food-facts";
import { RateLimitedError } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Recherche de produits du commerce dans Open Food Facts (rien n'est enregistré ici). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  try {
    const results = await searchOpenFoodFacts(user.id, query);
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitedError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof DomainError) return Response.json({ error: error.code }, { status: 502 });
    // Réponse d'OFF dans un format inattendu : même message pour l'utilisateur, détail dans les logs.
    console.error("[off] recherche impossible :", error instanceof ZodError ? error.issues : error);
    return Response.json({ error: "off_unavailable" }, { status: 502 });
  }
}
