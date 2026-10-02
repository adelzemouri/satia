import type { ReactNode } from "react";

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-accent-soft text-text border-accent",
    info: "bg-surface-muted text-text border-border",
    success: "bg-primary-soft text-text border-primary",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border-l-4 px-4 py-3 ${styles}`}>
      {children}
    </div>
  );
}
