"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";

import { requestQuickStart } from "@/features/ai/quick-start";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/ui/motion";
import { Icon, type ICONS } from "@/ui/icon";

/**
 * Position de chaque action sur l'arc au-dessus du + (décalage en px depuis le bouton) et son
 * délai, pour que les bulles sortent une à une, de gauche à droite.
 */
const ARC = [
  { x: -96, y: -64, delay: 0 },
  { x: -36, y: -116, delay: 30 },
  { x: 36, y: -116, delay: 60 },
  { x: 96, y: -64, delay: 90 },
] as const;

/** Sans IA configurée, il ne reste que le code-barres et la recherche, de part et d'autre du +. */
const PAIR = [
  { x: -56, y: -84, delay: 0 },
  { x: 56, y: -84, delay: 30 },
] as const;

const BUBBLE = "flex size-12 items-center justify-center rounded-full shadow-lg shadow-primary/25";

/**
 * Le + de la barre du bas : il tourne en × et fait sortir en éventail la photo, la voix, le
 * code-barres et la recherche. Le fond se floute ; un toucher dessus, Échap ou un choix referme.
 * La photo et le code-barres ouvrent l'appareil photo de l'app (avec ses récents et la galerie).
 */
export function AddFan({
  open,
  onOpenChange,
  ai,
  onCamera,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ouvre l'appareil photo de l'app sur le mode choisi. */
  onCamera: (mode: "photo" | "barcode") => void;
  /** La photo et la voix ne sont proposées que si un fournisseur d'IA est configuré. */
  ai: boolean;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const arc = ai ? ARC : PAIR;

  useEffect(() => {
    if (!open) return;
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

  const camera = (mode: "photo" | "barcode") => {
    onOpenChange(false);
    onCamera(mode);
  };

  const speak = () => {
    onOpenChange(false);
    requestQuickStart({ kind: "voice" });
    router.push("/add");
  };

  const item = (index: number, icon: keyof typeof ICONS, label: string, main = false) => ({
    style: {
      transform: open ? `translate(${arc[index]!.x}px, ${arc[index]!.y}px) scale(1)` : "translate(0, 0) scale(0.6)",
      transitionDelay: open ? `${arc[index]!.delay}ms` : "0ms",
    },
    className:
      "group absolute bottom-0 left-1/2 -ml-8 flex w-16 flex-col items-center gap-1 text-xs font-bold text-text transition-[transform,opacity,visibility] focus-visible:outline-2 " +
      // Ouverture avec un petit rebond ; fermeture plus rapide, sans rebond, toutes les bulles
      // ensemble. Fermé, l'éventail sort aussi de l'arbre d'accessibilité (visibility), après l'animation.
      (open
        ? "visible opacity-100 duration-[260ms] ease-pop"
        : "pointer-events-none invisible opacity-0 duration-150 ease-out-strong"),
    content: (
      <>
        <span
          className={`${BUBBLE} transition-transform duration-[120ms] ease-out-strong group-active:scale-[0.92] ${main ? "bg-primary text-on-primary" : "bg-surface text-primary"}`}
        >
          <Icon name={icon} size={24} />
        </span>
        <span className="rounded-full bg-surface px-2 whitespace-nowrap">{label}</span>
      </>
    ) as ReactNode,
  });

  const photo = item(0, "camera", t("addPhoto"), true);
  const voice = item(1, "mic", t("addVoice"));
  const barcode = item(ai ? 2 : 0, "barcode", t("addBarcode"));
  const search = item(ai ? 3 : 1, "search", t("addSearch"));

  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="add-fan"
        aria-label={open ? t("addClose") : t("addMeal")}
        className="-mt-3 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/30 transition-transform duration-[120ms] ease-out-strong active:scale-[0.94]"
      >
        {/* Le + devient × en un quart de tour court ; le bouton, lui, s'enfonce sous le doigt. */}
        <span className={`flex transition-transform duration-200 ease-out-strong ${open ? "rotate-45" : ""}`}>
          <Icon name="plus" size={26} />
        </span>
      </button>
      {/* Après le + dans le document : au clavier, Tab passe du + aux actions de l'éventail. */}
      <div id="add-fan" inert={!open} className="absolute bottom-full left-1/2 h-0 w-0">
        {ai && (
          <>
            <button
              type="button"
              onClick={() => camera("photo")}
              aria-haspopup="dialog"
              style={photo.style}
              className={photo.className}
            >
              {photo.content}
            </button>
            <button type="button" onClick={speak} style={voice.style} className={voice.className}>
              {voice.content}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => camera("barcode")}
          aria-haspopup="dialog"
          style={barcode.style}
          className={barcode.className}
        >
          {barcode.content}
        </button>
        <Link href="/add" onClick={() => onOpenChange(false)} style={search.style} className={search.className}>
          {search.content}
        </Link>
      </div>
    </div>
  );
}
