"use client";

/** Case à cocher en carte, toute la ligne cliquable ; surlignée une fois cochée. */
export function CheckCard({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  name?: string;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-bg px-4 has-checked:border-primary has-checked:bg-primary-soft">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}
