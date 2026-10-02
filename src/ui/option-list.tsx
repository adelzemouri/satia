import { useId } from "react";

type Option<T extends string | number> = { value: T; label: string; hint?: string };

/** Liste de choix exclusifs en grandes cartes tactiles (radio natif, navigable au clavier). */
export function OptionList<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  hideLegend = false,
}: {
  legend: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  hideLegend?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={hideLegend ? "sr-only" : "mb-2 font-semibold"}>{legend}</legend>
      {options.map((option) => {
        const inputId = `${id}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]"
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{option.label}</span>
              {option.hint && <span className="text-sm text-text-muted">{option.hint}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
