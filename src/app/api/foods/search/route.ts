import { searchFoods } from "@/server/foods";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Recherche dans la base locale (Ciqual, produits OFF en cache, aliments personnels). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  const results = await searchFoods(user.id, query);
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
