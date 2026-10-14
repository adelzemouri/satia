"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { lastShown, rememberShown } from "@/ui/motion";

const MEMORY_KEY = "ring-consumed";

/**
 * « +120 » au bord de l'anneau quand des calories se sont ajoutées depuis la dernière fois qu'on
 * l'a vu : on voit ce que le repas a apporté. Il monte un peu et s'efface. Décoratif : les valeurs
 * sont déjà données en texte à côté de l'anneau. À monter avec `key={consumed}` pour qu'un ajout
 * sur place le rejoue.
 */
export function RingGain({ consumed }: { consumed: number }) {
  const locale = useLocale();
  const [gain] = useState(() => {
    const previous = lastShown(MEMORY_KEY);
    return previous !== undefined && consumed > previous ? consumed - previous : 0;
  });

  useEffect(() => rememberShown(MEMORY_KEY, consumed), [consumed]);

  if (gain <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="gain-float pointer-events-none absolute -top-1 -right-2 rounded-full bg-primary-soft px-2 py-0.5 text-sm font-extrabold text-primary tabular-nums opacity-0"
    >
      +{new Intl.NumberFormat(locale).format(gain)}
    </span>
  );
}
