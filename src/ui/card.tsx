import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}
