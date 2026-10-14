"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, type ReactNode, useEffect, useRef } from "react";

import { requestQuickStart } from "@/features/ai/quick-start";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/ui/motion";
import { Icon, type ICONS } from "@/ui/icon";

/**
 * Position de chaque action sur l'arc au-dessus du + (décalage en px depuis le bouton) et son
 * délai, pour que les bulles rebondissent une à une, de gauche à droite.
 */
const ARC = [
  { x: -96, y: -64, delay: 0 },
  { x: -36, y: -116, delay: 40 },
  { x: 36, y: -116, delay: 80 },
  { x: 96, y: -64, delay: 120 },
] as const;

const BUBBLE = "flex size-12 items-center justify-center rounded-full shadow-lg shadow-primary/25";

/**
 * Le + de la barre du bas : il tourne en × et fait jaillir en éventail la photo, la voix, le
 * code-barres et la recherche. Le fond se floute ; un toucher dessus, Échap ou un choix referme.
 */
export function AddFan({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const toggle = () => {
    haptic();
    onOpenChange(!open);
  };

  const takePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    onOpenChange(false);
    if (!file) return;
    requestQuickStart({ kind: "photo", file });
    router.push("/add");
  };

  const speak = () => {
    onOpenChange(false);
    requestQuickStart({ kind: "voice" });
    router.push("/add");
  };

  const item = (index: number, icon: keyof typeof ICONS, label: string, main = false) => ({
    style: {
      transform: open ? `translate(${ARC[index]!.x}px, ${ARC[index]!.y}px) scale(1)` : "translate(0, 0) scale(0.3)",
      transitionDelay: open ? `${ARC[index]!.delay}ms` : "0ms",
    },
    className:
      "absolute bottom-0 left-1/2 -ml-8 flex w-16 flex-col items-center gap-1 text-xs font-bold text-text transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-2 " +
      (open ? "opacity-100" : "pointer-events-none opacity-0"),
    content: (
      <>
        <span className={`${BUBBLE} ${main ? "bg-primary text-on-primary" : "bg-surface text-primary"}`}>
          <Icon name={icon} size={24} />
        </span>
        <span className="rounded-full bg-surface px-2 whitespace-nowrap">{label}</span>
      </>
    ) as ReactNode,
  });

  const photo = item(0, "camera", t("addPhoto"), true);
  const voice = item(1, "mic", t("addVoice"));
  const barcode = item(2, "barcode", t("addBarcode"));
  const search = item(3, "search", t("addSearch"));

  return (
    <div className="relative flex justify-center">
      <div id="add-fan" inert={!open} className="absolute bottom-full left-1/2 h-0 w-0">
        <label style={photo.style} className={`${photo.className} cursor-pointer focus-within:outline-2`}>
          {photo.content}
          <input
            ref={first}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={takePhoto}
            className="sr-only"
          />
        </label>
        <button type="button" onClick={speak} style={voice.style} className={voice.className}>
          {voice.content}
        </button>
        <Link href="/scan" onClick={() => onOpenChange(false)} style={barcode.style} className={barcode.className}>
          {barcode.content}
        </Link>
        <Link href="/add" onClick={() => onOpenChange(false)} style={search.style} className={search.className}>
          {search.content}
        </Link>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="add-fan"
        aria-label={open ? t("addClose") : t("addMeal")}
        className={`-mt-3 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/30 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "rotate-[135deg]" : ""}`}
      >
        <Icon name="plus" size={26} />
      </button>
    </div>
  );
}
