import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";

/**
 * L'ancien « Espace famille » : les recettes du foyer sont dans Cuisine › Recettes, les repas partagés
 * à valider sur l'accueil, et « Partager un plat » dans Cuisine › Menu.
 */
export default async function FamilyPage({ params }: PageProps<"/[locale]/family">) {
  const locale = toLocale((await params).locale);
  return redirect({ href: "/plan", locale });
}
