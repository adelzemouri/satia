import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { exerciseById } from "@/domain/training/exercises";
import { ExerciseFigure } from "@/features/training/exercise-figure";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function ExercisePage({ params }: PageProps<"/[locale]/training/library/[id]">) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);
  await requireUser(locale);
  const exercise = exerciseById(id);
  if (!exercise) notFound();
  const t = await getTranslations("training");

  return (
    <>
      <Link href="/training/library" className="font-semibold text-primary underline-offset-4 hover:underline">
        {t("library.title")}
      </Link>
      <div className="flex items-center gap-4">
        <ExerciseFigure muscle={exercise.muscle} size={72} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{exercise.name}</h1>
      </div>
      <p className="text-text-muted">
        {t(`muscles.${exercise.muscle}`)} ·{" "}
        {exercise.equipment.length === 0
          ? t("equipment.none")
          : exercise.equipment.map((item) => t(`equipment.${item}`)).join(", ")}{" "}
        · {t("library.levelValue", { level: exercise.level })}
      </p>
      <Card aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl font-semibold">
          {t("session.how")}
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {exercise.steps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h2 className="text-lg font-semibold">{t("session.watch")}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {exercise.mistakes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>{t("session.easier", { text: exercise.easier })}</p>
        {exercise.harder && <p className="text-text-muted">{t("session.harder", { text: exercise.harder })}</p>}
      </Card>
      {exercise.stress.length > 0 && (
        <p className="text-sm text-text-muted">
          {t("library.stress", { list: exercise.stress.map((zone) => t(`zones.${zone}`)).join(", ") })}
        </p>
      )}
    </>
  );
}
