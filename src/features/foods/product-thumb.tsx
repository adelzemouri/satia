import Image from "next/image";

/**
 * Vignette d'un produit (photo Open Food Facts) ; un carré neutre la remplace quand il n'y en
 * a pas. Décorative : le nom du produit est toujours écrit à côté.
 */
export function ProductThumb({ src, size = 48 }: { src: string | null; size?: number }) {
  if (!src)
    return <span aria-hidden className="shrink-0 rounded-lg bg-surface-muted" style={{ width: size, height: size }} />;
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-lg bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
}
