"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { fullSizeImageUrl } from "@/domain/image-size";

import { Icon } from "./icon";

export type ViewerPhoto = { src: string; alt: string };

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PX = 60;
const CLOSE_PX = 100;

type View = { scale: number; x: number; y: number };
const REST: View = { scale: 1, x: 0, y: 0 };

/**
 * Photo en plein écran, fond noir : pincer ou toucher deux fois pour zoomer, glisser pour passer
 * à la photo suivante, glisser vers le bas (ou Échap) pour fermer. Ouverte par `ZoomablePhoto`
 * ou `PhotoGallery`.
 */
export function PhotoViewer({
  photos,
  start = 0,
  caption,
  onClose,
}: {
  photos: readonly ViewerPhoto[];
  start?: number;
  caption?: string;
  onClose: () => void;
}) {
  const t = useTranslations("photoViewer");
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const [view, setView] = useState<View>(REST);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const [fallback, setFallback] = useState<ReadonlySet<string>>(new Set());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; dist: number; view: View; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  const photo = photos[index]!;
  const full = fullSizeImageUrl(photo.src);
  const src = fallback.has(full) ? photo.src : full;
  const many = photos.length > 1;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    // La page derrière ne défile pas pendant que la photo est ouverte (iOS ignore le dialogue modal).
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
      if (element.open) element.close();
    };
  }, []);

  const go = (step: number) => {
    if (!many) return;
    setIndex((current) => (current + step + photos.length) % photos.length);
    setView(REST);
  };

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setMoving(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      dist: distance(),
      view,
      moved: gesture.current?.moved ?? false,
    };
    if (pointers.current.size > 1) gesture.current.moved = true;
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.hypot(dx, dy) > 8) g.moved = true;
    if (pointers.current.size > 1 && g.dist > 0) {
      const scale = Math.min(MAX_SCALE, Math.max(1, (g.view.scale * distance()) / g.dist));
      setView({ ...g.view, scale });
    } else if (g.view.scale > 1) {
      // La photo zoomée se déplace, sans sortir de l'écran.
      const stage = event.currentTarget.getBoundingClientRect();
      const maxX = ((g.view.scale - 1) * stage.width) / 2;
      const maxY = ((g.view.scale - 1) * stage.height) / 2;
      const clamp = (value: number, max: number) => Math.min(max, Math.max(-max, value));
      setView({ ...g.view, x: clamp(g.view.x + dx, maxX), y: clamp(g.view.y + dy, maxY) });
    } else {
      setDrag({ x: dx, y: Math.max(0, dy) });
    }
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    if (!g) return;
    if (pointers.current.size > 0) {
      // Un doigt reste posé après le pincement : on repart de là pour déplacer la photo.
      const [rest] = [...pointers.current.values()];
      gesture.current = { startX: rest!.x, startY: rest!.y, dist: 0, view, moved: true };
      return;
    }
    gesture.current = null;
    setMoving(false);
    setDrag({ x: 0, y: 0 });
    if (!g.moved) {
      const now = event.timeStamp;
      if (now - lastTap.current < 300) {
        setView((current) => (current.scale > 1 ? REST : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 }));
        lastTap.current = 0;
      } else lastTap.current = now;
      return;
    }
    if (view.scale <= 1) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (dy > CLOSE_PX && dy > Math.abs(dx)) onClose();
      else if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      setView(REST);
    }
  };

  const zoomBy = (factor: number) =>
    setView((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(1, current.scale * factor));
      return scale === 1 ? REST : { ...current, scale };
    });

  const transform = `translate(${view.x + drag.x}px, ${view.y + drag.y}px) scale(${view.scale})`;

  return (
    <dialog
      ref={dialog}
      aria-label={caption ?? photo.alt}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        else if (event.key === "ArrowLeft") go(-1);
        else if (event.key === "+" || event.key === "=") zoomBy(1.5);
        else if (event.key === "-") zoomBy(1 / 1.5);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none flex-col bg-black p-0 text-white backdrop:bg-black open:flex"
      style={{ opacity: drag.y > 0 ? Math.max(0.4, 1 - drag.y / 400) : 1 }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <p className="min-w-0 truncate text-sm font-semibold">
          {caption}
          {many && (
            <span className="font-normal text-white/70">
              {caption && " · "}
              {t("position", { index: index + 1, count: photos.length })}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 touch-none overflow-hidden select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL signée, Open Food Facts ou WebP déjà redimensionné */}
          <img
            key={src}
            src={src}
            alt={photo.alt}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFallback((current) => new Set(current).add(full))}
            className={`absolute inset-0 m-auto max-h-full max-w-full object-contain ${moving ? "" : "transition-transform duration-200 motion-reduce:transition-none"}`}
            style={{ transform }}
          />
        </div>
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("previous")}
              className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:grid"
            >
              <Icon name="left" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("next")}
              className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:grid"
            >
              <Icon name="right" />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {many && (
          <div className="flex gap-1.5" aria-hidden="true">
            {photos.map((item, i) => (
              <span key={item.src} className={`size-2 rounded-full ${i === index ? "bg-white" : "bg-white/35"}`} />
            ))}
          </div>
        )}
        <p className="text-center text-xs text-white/70">{t(many ? "hintMany" : "hint")}</p>
      </div>
    </dialog>
  );
}

function ZoomBadge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white"
    >
      <Icon name="search" size={14} />
    </span>
  );
}

/** Rend une image touchable pour l'ouvrir en grand ; `children` est l'image telle qu'affichée. */
export function ZoomablePhoto({
  photo,
  caption,
  className = "",
  children,
}: {
  photo: ViewerPhoto;
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("photoViewer");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open", { name: photo.alt })}
        aria-haspopup="dialog"
        className={`relative block cursor-zoom-in ${className}`}
      >
        {children}
        <ZoomBadge />
      </button>
      {open && <PhotoViewer photos={[photo]} caption={caption} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Vignettes des photos d'un repas ; chacune s'ouvre en grand, et l'on passe de l'une à l'autre. */
export function PhotoGallery({ photos, caption }: { photos: readonly ViewerPhoto[]; caption?: string }) {
  const t = useTranslations("photoViewer");
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={t("open", { name: photo.alt })}
            aria-haspopup="dialog"
            className="relative cursor-zoom-in overflow-hidden rounded-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage privé, valable 5 min */}
            <img src={photo.src} alt="" className="size-24 object-cover" />
            <ZoomBadge />
          </button>
        ))}
      </div>
      {open !== null && <PhotoViewer photos={photos} start={open} caption={caption} onClose={() => setOpen(null)} />}
    </>
  );
}
