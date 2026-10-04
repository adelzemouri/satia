import { recipePhotoUrl } from "@/server/foods";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Photo d'une recette du foyer : stockée dans le bucket privé, elle n'est servie qu'aux
 * personnes qui voient la recette, par une redirection vers une URL signée courte.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/foods/[id]/photo">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const url = /^[0-9a-f-]{36}$/.test(id) ? await recipePhotoUrl(user.id, id) : null;
  if (!url) return new Response("Not found", { status: 404 });
  // Le navigateur garde la redirection un peu moins longtemps que la validité de l'URL signée.
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=240" } });
}
