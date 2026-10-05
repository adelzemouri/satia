/** Verre stylisé : contour, et eau qui monte quand il est compté (aussi utilisé par le journal). */
export function Glass({ full, fresh }: { full: boolean; fresh: boolean }) {
  return (
    <svg viewBox="0 0 24 30" className={`h-8 w-6 ${fresh ? "pop" : ""}`}>
      <path
        d="M3 3h18l-2.2 23.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"
        className={full ? "fill-fat/25 stroke-fat" : "fill-none stroke-border"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {full && <path d="M5.4 11h13.2l-1.6 15H7z" className="fill-fat" />}
    </svg>
  );
}
