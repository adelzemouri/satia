import { FEELINGS, type Feeling } from "@/domain/training/types";

/** Jauge d'effort du ressenti : trois barres qui montent ; « Trop dur » passe en rouge pomme. */
export function EffortBars({ feeling, small = false }: { feeling: Feeling; small?: boolean }) {
  const level = FEELINGS.indexOf(feeling) + 1;
  return (
    <span aria-hidden="true" className={`flex items-end ${small ? "h-3.5 gap-0.5" : "h-7 gap-1"}`}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`rounded-full ${small ? "w-1" : "w-2"} ${bar <= level ? (level === 3 ? "bg-pomme" : "bg-primary") : "bg-border"}`}
          style={{ height: `${bar * 33}%` }}
        />
      ))}
    </span>
  );
}
