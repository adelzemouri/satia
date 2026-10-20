"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePathname } from "@/i18n/navigation";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";

import { FeedbackForm } from "./feedback-form";
import { feedbackPage } from "./route-memory";

/** Ancre des liens qui ouvrent la fiche (« Une remarque, un bug ? » dans Moi). */
export const FEEDBACK_HASH = "remarque";

/**
 * Fiche « Écrire à … ». Elle s'ouvre sans navigation, en interceptant les liens vers
 * `#remarque` : une navigation afficherait le squelette de la page et ferait perdre le défilement.
 */
export function FeedbackHost({ recipient }: { recipient: string | null }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href$="#${FEEDBACK_HASH}"]`);
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={recipient ? t("titleTo", { name: recipient }) : t("title")}
      closeLabel={t("close")}
    >
      <FeedbackForm
        page={feedbackPage(pathname)}
        onSent={() => {
          setOpen(false);
          toast({ message: recipient ? t("sentTo", { name: recipient }) : t("sent") });
        }}
      />
    </Sheet>
  );
}
