import type { ReactNode } from "react";

/** Recréé à chaque navigation : la nouvelle page arrive en fondu léger. */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="page-in flex flex-col gap-6">{children}</div>;
}
