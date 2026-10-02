import { type InputHTMLAttributes, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** Champ de saisie accessible : libellé, aide et erreur reliés par ARIA. */
export function Field({ label, hint, error, id, className = "", ...props }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={`min-h-12 rounded-2xl border border-border bg-surface px-4 text-base aria-[invalid]:border-[var(--color-accent)] ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
