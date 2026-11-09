import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Icon, type ICONS } from "@/ui/icon";

/**
 * Ligne de la liste « Aussi aujourd'hui » de l'accueil : une icône, un titre et une précision,
 * la valeur à droite ; toute la ligne est un lien. Les lignes se suivent dans une seule carte.
 */
function Tile({
  href,
  icon,
  title,
  value,
  hint,
  children,
}: {
  href: string;
  icon: keyof typeof ICONS;
  title: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 py-3">
      <span className="shrink-0 text-primary">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold">{title}</span>
        {hint && <span className="text-sm text-text-muted">{hint}</span>}
        {children}
      </span>
      <span className="shrink-0 text-right font-semibold tabular-nums">{value}</span>
      <span className="shrink-0 text-text-muted" aria-hidden="true">
        <Icon name="right" size={16} />
      </span>
    </Link>
  );
}

/** Pas du jour et calories dépensées en activité, sur deux lignes de la liste de l'accueil. */
export async function ActivityTiles({ steps, burnedKcal }: { steps: number; burnedKcal: number }) {
  const t = await getTranslations("home.cards");
  return (
    <>
      <Tile
        href="/activity"
        icon="run"
        title={t("steps")}
        value={t("stepsValue", { steps })}
        hint={steps === 0 ? t("stepsEmpty") : undefined}
      />
      <Tile
        href="/activity"
        icon="pulse"
        title={t("activity")}
        value={t("kcal", { value: burnedKcal })}
        hint={burnedKcal === 0 ? t("activityEmpty") : t("activityHint")}
      />
    </>
  );
}

/** Jeûne en cours (barre de progression) ou planning de jeûne actif sans jeûne en cours. */
export async function FastingTile({
  fast,
  now,
}: {
  fast: { startedAt: string; targetMinutes: number } | null;
  now: Date;
}) {
  const t = await getTranslations("home");
  if (!fast) {
    return <Tile href="/fasting" icon="timer" title={t("cards.fasting")} value={t("cards.fastingIdle")} />;
  }
  const elapsed = Math.max(0, Math.round((now.getTime() - new Date(fast.startedAt).getTime()) / 60_000));
  const percent = Math.min(100, (elapsed / fast.targetMinutes) * 100);
  const end = new Date(new Date(fast.startedAt).getTime() + fast.targetMinutes * 60_000);
  return (
    <Tile
      href="/fasting"
      icon="timer"
      title={t("fastRunning")}
      value={t("cards.fastingElapsed", { h: Math.floor(elapsed / 60), m: elapsed % 60 })}
      hint={t("fastUntil", { end })}
    >
      <span
        role="progressbar"
        aria-label={t("cards.fastingProgress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <span className="bar-grow block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </span>
    </Tile>
  );
}

/** Rappel des traitements prévus aujourd'hui, avec la prise déjà notée ou non. */
export async function TreatmentTile({
  reminders,
}: {
  reminders: { id: string; name: string; time: string; taken: boolean }[];
}) {
  const t = await getTranslations("home.cards");
  const pending = reminders.filter((reminder) => !reminder.taken);
  const next = pending[0] ?? reminders[0]!;
  return (
    <Tile
      href="/treatment"
      icon="pill"
      title={t("treatment")}
      value={
        pending.length === 0 ? t("treatmentDone") : t("treatmentDue", { name: next.name, time: next.time.slice(0, 5) })
      }
      hint={t("treatmentHint")}
    />
  );
}
