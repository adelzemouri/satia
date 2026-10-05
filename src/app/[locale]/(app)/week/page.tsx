import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";

/** L'ancienne page « Ma semaine » (budget hebdomadaire) a été retirée : son lien mène à Progrès. */
export default async function WeekPage({ params }: PageProps<"/[locale]/week">) {
  redirect({ href: "/progress", locale: toLocale((await params).locale) });
}
