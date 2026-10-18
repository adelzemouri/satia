import type { BetaDay } from "@/domain/beta";

const dayClass: Record<BetaDay, string> = {
  logged: "bg-primary",
  empty: "bg-surface-muted",
  before: "border border-dashed border-border",
};

/** Bande des 28 derniers jours : une case colorée par jour où l'invité a noté au moins un repas. */
export function BetaGuestStrip({ days, label }: { days: BetaDay[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-[3px]">
      {days.map((day, index) => (
        <span key={index} className={`aspect-square rounded-[3px] ${dayClass[day]}`} />
      ))}
    </div>
  );
}
