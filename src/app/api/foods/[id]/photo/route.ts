import { recipePhoto } from "@/server/foods";
import { shrinkRecipePhoto } from "@/server/recipe-photo-image";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Au-delà, une ancienne photo générée encore brute est réduite avant d'être envoyée. */
const SHRINK_ABOVE_BYTES = 300_000;

/**
 * Photo d'une recette du foyer : stockée dans le bucket privé, elle n'est servie qu'aux
 * personnes qui voient la recette. Son adresse change avec la photo (`?v=`), donc le
 * téléphone la garde : elle n'est téléchargée qu'une fois au lieu de l'être à chaque affichage
 * (une URL signée, différente à chaque fois, empêchait toute mise en cache).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/foods/[id]/photo">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const photo = /^[0-9a-f-]{36}$/.test(id) ? await recipePhoto(user.id, id) : null;
  if (!photo) return new Response("Not found", { status: 404 });
  let { body, contentType } = photo;
  if (body.length > SHRINK_ABOVE_BYTES) {
    const small = await shrinkRecipePhoto(body);
    if (small) [body, contentType] = [small, "image/webp"];
  }
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": contentType,
      // Privée (photo du foyer) ; 30 jours quand l'adresse porte la version de la photo.
      "Cache-Control": versioned ? "private, max-age=2592000, immutable" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
