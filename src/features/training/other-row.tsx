import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icon";

const rowClass = "flex min-h-16 w-full items-center gap-3 py-3 text-left [@media(hover:hover)]:hover:text-primary";

function Content({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-text-muted">{hint}</span>
      </span>
      <span className="text-text-muted">
        <Icon name="right" size={18} />
      </span>
    </>
  );
}

/** Une ligne de « Autre envie ? » : un lien, ou un bouton qui ouvre un panneau. */
export function OtherRow({
  icon,
  title,
  hint,
  href,
  onClick,
}: {
  icon: IconName;
  title: string;
  hint: string;
  href?: ComponentProps<typeof Link>["href"];
  onClick?: () => void;
}) {
  if (href) {
    return (
      <Link href={href} className={rowClass}>
        <Content icon={icon} title={title} hint={hint} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowClass} aria-haspopup="dialog">
      <Content icon={icon} title={title} hint={hint} />
    </button>
  );
}
