import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  secondary: "bg-surface border-border text-text border hover:bg-surface-muted",
  danger: "bg-accent text-on-accent hover:brightness-110",
  ghost: "text-text hover:bg-surface-muted",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
