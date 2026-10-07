import { getTranslations, setRequestLocale } from "next-intl/server";

import { EXERCISES, exerciseById } from "@/domain/training/exercises";
import { EQUIPMENT, type Equipment, type Muscle, MUSCLES } from "@/domain/training/types";
import { CustomExercises } from "@/features/training/custom-exercises";
import { RestoreExerciseButton } from "@/features/training/exclusion-button";
import { ExerciseArt } from "@/features/training/exercise-art";
import { getPathname, Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { getTrainingProfile, listCustomExercises } from "@/server/training";
import { buttonClass } from "@/ui/button";
import { Card } from "@/ui/card";

const selectClass = "min-h-12 rounded-2xl border border-border bg-surface px-3 text-base";

export default async function TrainingLibraryPage({ params, searchParams }: PageProps<"/[locale]/training/library">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const muscle = MUSCLES.includes(query.muscle as Muscle) ? (query.muscle as Muscle) : null;
  const equipment = EQUIPMENT.includes(query.equipment as Equipment) ? (query.equipment as Equipment) : null;
  const level = ["1", "2", "3"].includes(String(query.level)) ? Number(query.level) : null;
  const [profile, custom] = await Promise.all([getTrainingProfile(user.id), listCustomExercises(user.id)]);
  const t = await getTranslations("training");

  const list = EXERCISES.filter(
    (exercise) =>
      (!muscle || exercise.muscle === muscle) &&
      (!equipment ||
        (equipment === "none" ? exercise.equipment.length === 0 : exercise.equipment.includes(equipment))) &&
      (!level || exercise.level === level),
  );

  return (
    <>
      <span data-wide hidden />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("library.title")}</h1>
      <p className="text-text-muted">{t("library.intro")}</p>

      <Card>
        <form action={getPathname({ href: "/training/library", locale })} method="get" className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("library.muscle")}</span>
              <select name="muscle" defaultValue={muscle ?? ""} className={selectClass}>
                <option value="">{t("library.all")}</option>
                {MUSCLES.map((value) => (
                  <option key={value} value={value}>
                    {t(`muscles.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("library.equipment")}</span>
              <select name="equipment" defaultValue={equipment ?? ""} className={selectClass}>
                <option value="">{t("library.all")}</option>
                {EQUIPMENT.map((value) => (
                  <option key={value} value={value}>
                    {t(`equipment.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">{t("library.level")}</span>
              <select name="level" defaultValue={level ? String(level) : ""} className={selectClass}>
                <option value="">{t("library.all")}</option>
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {t("library.levelValue", { level: value })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            {t("library.filter")}
          </button>
        </form>
      </Card>

      <p className="font-semibold" role="status">
        {t("library.count", { count: list.length })}
      </p>
      <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {list.map((exercise) => (
          <li key={exercise.id}>
            <Link
              href={`/training/library/${exercise.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 hover:bg-surface-muted"
            >
              <ExerciseArt exerciseId={exercise.id} muscle={exercise.muscle} size={64} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{exercise.name}</span>
                <span className="text-sm text-text-muted">
                  {t(`muscles.${exercise.muscle}`)} ·{" "}
                  {exercise.equipment.length === 0
                    ? t("equipment.none")
                    : exercise.equipment.map((item) => t(`equipment.${item}`)).join(", ")}{" "}
                  · {t("library.levelValue", { level: exercise.level })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {profile && profile.excluded.length > 0 && (
        <Card aria-labelledby="excluded-title">
          <h2 id="excluded-title" className="text-xl font-semibold">
            {t("library.excludedTitle")}
          </h2>
          <p className="text-sm text-text-muted">{t("library.excludedHint")}</p>
          <ul className="flex flex-col divide-y divide-border">
            {profile.excluded.map((id) => {
              const name = exerciseById(id)?.name ?? id;
              return (
                <li key={id} className="flex items-center justify-between gap-2 py-1">
                  <span>{name}</span>
                  <RestoreExerciseButton id={id} name={name} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card aria-labelledby="custom-title">
        <h2 id="custom-title" className="text-xl font-semibold">
          {t("library.customTitle")}
        </h2>
        <p className="text-sm text-text-muted">{t("library.customHint")}</p>
        <CustomExercises items={custom} />
      </Card>
    </>
  );
}
