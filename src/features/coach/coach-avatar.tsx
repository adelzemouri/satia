/**
 * Pépin, le coach : une petite pomme souriante, tige et feuille, cousine du logo (rouge pomme et
 * feuille verte). Dessin original ; décoratif, le prénom est toujours écrit à côté.
 */
export function CoachAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx="24" cy="24" r="24" className="fill-pomme-soft" />
      {/* Pomme */}
      <path
        d="M24 16.5c-3.2-2.4-8-2.8-11.2-.4-3.7 2.8-4.5 7.8-3.4 12.4 1.4 6.2 6 11.5 10.6 11.5 1.7 0 2.7-.9 4-.9s2.3.9 4 .9c4.6 0 9.2-5.3 10.6-11.5 1.1-4.6.3-9.6-3.4-12.4-3.2-2.4-8-2-11.2.4z"
        fill="#D9573C"
      />
      <ellipse cx="15.2" cy="22.5" rx="1.9" ry="3.4" fill="#FFFFFF" opacity="0.35" transform="rotate(20 15.2 22.5)" />
      {/* Tige et feuille */}
      <path d="M24 16.5c0-2.7.7-4.9 2.2-6.6" stroke="#6B3F24" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M26 11.2c2.6-3.2 6.4-3.9 9.1-2.8-1.1 3.2-4.9 5.1-9.1 2.8z" fill="#4FA06E" />
      {/* Visage */}
      <ellipse cx="20" cy="26.5" rx="1.6" ry="2.2" fill="#3B1F14" />
      <ellipse cx="28" cy="26.5" rx="1.6" ry="2.2" fill="#3B1F14" />
      <path d="M20.6 31.3c2 1.8 4.8 1.8 6.8 0" stroke="#3B1F14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16.4" cy="30.4" r="1.7" fill="#F7B3A0" opacity="0.9" />
      <circle cx="31.6" cy="30.4" r="1.7" fill="#F7B3A0" opacity="0.9" />
    </svg>
  );
}
