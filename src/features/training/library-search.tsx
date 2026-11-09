"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { Icon } from "@/ui/icon";
import { SearchInput } from "@/ui/search-input";

/**
 * Recherche dans la bibliothèque d'exercices : l'adresse suit la saisie (`?q=`), en gardant les
 * filtres choisis, pour que la liste filtrée côté serveur se mette à jour sans bouton.
 */
export function LibrarySearch({ initial, label }: { initial: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(initial);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const update = (value: string) => {
    setQuery(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    }, 250);
  };

  return (
    <label className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 focus-within:outline-2 focus-within:outline-[var(--color-focus)] lg:max-w-md">
      <Icon name="search" size={20} />
      <span className="sr-only">{label}</span>
      <SearchInput value={query} onValueChange={update} placeholder={label} />
    </label>
  );
}
