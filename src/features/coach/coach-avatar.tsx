/**
 * Pépin, le coach : un pépin de pomme souriant avec une jeune pousse. Dessin original, en
 * couleurs de l'app ; décoratif, le prénom est toujours écrit à côté.
 */
export function CoachAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx="24" cy="24" r="24" className="fill-primary-soft" />
      {/* Pousse */}
      <path d="M24 15c0-3 1-5.5 3.5-7" className="stroke-primary" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M26.5 9.5c2.8-2.4 6.3-2.6 8.5-1.6-1 2.6-4.3 4.4-8.5 1.6z" className="fill-primary" />
      {/* Pépin */}
      <path
        d="M24 13c6.5 4.2 10 10.3 10 16.2C34 35.6 29.6 40 24 40s-10-4.4-10-10.8C14 23.3 17.5 17.2 24 13z"
        fill="#7A4B2C"
      />
      <path d="M19.5 22.5c1.3-2.6 3-4.6 4.5-5.8" stroke="#B9835A" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Visage */}
      <circle cx="20.5" cy="29" r="1.6" fill="#FFF7EE" />
      <circle cx="27.5" cy="29" r="1.6" fill="#FFF7EE" />
      <path d="M21 33.2c1.8 1.6 4.2 1.6 6 0" stroke="#FFF7EE" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="32.5" r="1.4" fill="#F4A58E" opacity="0.8" />
      <circle cx="30" cy="32.5" r="1.4" fill="#F4A58E" opacity="0.8" />
    </svg>
  );
}
