import { notFound } from "next/navigation";

// Adresse inconnue : la page 404 passe par la mise en page de la langue (nonce CSP compris)
// plutôt que par la 404 statique de Next.js, dont les scripts sont bloqués par la CSP.
export default function UnknownPage() {
  notFound();
}
