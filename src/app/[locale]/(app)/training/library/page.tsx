import { getTranslations, setRequestLocale } from "next-intl/server";

import { EXERCISES, exerciseById } from "@/domain/training/exercises";
import { EQUIPMENT, type Equipment, type Muscle, MUSCLES } from "@/domain/training/types";
import { CustomExercises } from "@/features/training/custom-exercises";
import { RestoreExerciseButton } from "@/features/training/exclusion-button";
import { ExerciseArt } from "@/features/training/exercise-art";
import { LibrarySearch } from "@/features/training/library-search";
import { Link } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/server/session";
import { getTrainingProfile, listCustomExercises } from "@/server/training";
import { Card } from "@/ui/card";

/** Recherche sans accents ni majuscules (« planche » trouve « Planche »). */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default async function TrainingLibraryPage({ params, searchParams }: PageProps<"/[locale]/training/library">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const query = await searchParams;
  const muscle = MUSCLES.includes(query.muscle as Muscle) ? (query.muscle as Muscle) : null;
  const equipment = EQUIPMENT.includes(query.equipment as Equipment) ? (query.equipment as Equipment) : null;
  const level = ["1", "2", "3"].includes(String(query.level)) ? Number(query.level) : null;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  const [profile, custom] = await Promise.all([getTrainingProfile(user.id), listCustomExercises(user.id)]);
  const t = await getTranslations("training");

  const list = EXERCISES.filter(
    (exercise) =>
      (!muscle || exercise.muscle === muscle) &&
      (!equipment ||
        (equipment === "none" ? exercise.equipment.length === 0 : exercise.equipment.includes(equipment))) &&
      (!level || exercise.level === level) &&
      (!search || normalize(exercise.name).includes(normalize(search))),
  );

  // Filtres de l'ordinateur : des liens qui gardent les deux autres critères, sans bouton « Filtrer ».
  const current = { muscle, equipment, level: level ? String(level) : null };
  const filterHref = (key: keyof typeof current, value: string | null) => {
    const next = { ...current, [key]: value };
    const kept = Object.fromEntries(
      Object.entries({ ...next, q: search || null }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    return { pathname: "/training/library" as const, query: kept };
  };
  const chip = (active: boolean) =>
    `flex min-h-10 shrink-0 items-center rounded-full border-2 px-3.5 text-sm font-semibold whitespace-nowrap lg:min-h-9 lg:border-0 lg:px-3 ${
      active
        ? "border-primary bg-primary text-on-primary"
        : "border-border bg-surface text-text lg:bg-surface-muted [@media(hover:hover)]:hover:bg-border"
    }`;
  const groups: { key: keyof typeof current; title: string; options: { value: string; label: string }[] }[] = [
    {
      key: "muscle",
      title: t("library.muscle"),
      options: MUSCLES.map((value) => ({ value, label: t(`muscles.${value}`) })),
    },
    {
      key: "equipment",
      title: t("library.equipment"),
      options: EQUIPMENT.map((value) => ({ value, label: t(`equipment.${value}`) })),
    },
    {
      key: "level",
      title: t("library.level"),
      options: ["1", "2", "3"].map((value) => ({ value, label: t("library.levelValue", { level: Number(value) }) })),
    },
  ];

  return (
    <>
      <span data-wide hidden />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("library.title")}</h1>
      <p className="text-text-muted">{t("library.intro")}</p>
      <LibrarySearch initial={search} label={t("library.search")} />

      {/* Téléphone : une rangée de pastilles par critère, qui défile de côté. Ordinateur : les
          filtres en colonne à gauche, restant visibles pendant le défilement. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav
          aria-label={t("library.filtersLabel")}
          className="flex flex-col gap-3 lg:sticky lg:top-8 lg:row-span-2 lg:gap-4 lg:rounded-[var(--radius-card)] lg:bg-surface lg:p-4"
        >
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1.5 lg:gap-2">
              <h2 className="font-sans text-sm font-semibold text-text-muted">{group.title}</h2>
              <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
                {[{ value: null, label: t("library.all") }, ...group.options].map((option) => {
                  const active = current[group.key] === option.value;
                  return (
                    <li key={option.value ?? "all"}>
                      <Link
                        href={filterHref(group.key, option.value)}
                        aria-current={active ? "true" : undefined}
                        scroll={false}
                        className={chip(active)}
                      >
                        {option.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <p className="font-semibold lg:col-start-2" role="status">
          {t("library.count", { count: list.length })}
        </p>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:col-start-2 lg:gap-4 xl:grid-cols-4">
          {list.map((exercise) => (
            <li key={exercise.id}>
              <Link
                href={`/training/library/${exercise.id}`}
                className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-2 [@media(hover:hover)]:hover:bg-surface-muted"
              >
                <ExerciseArt exerciseId={exercise.id} muscle={exercise.muscle} className="h-auto w-full rounded-xl" />
                <span className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
                  <span className="leading-snug font-semibold">{exercise.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span
                      className="flex gap-0.5"
                      role="img"
                      aria-label={t("library.levelValue", { level: exercise.level })}
                    >
                      {[1, 2, 3].map((dot) => (
                        <span
                          key={dot}
                          className={`size-1.5 rounded-full ${dot <= exercise.level ? "bg-primary" : "bg-border"}`}
                        />
                      ))}
                    </span>
                    {t(`muscles.${exercise.muscle}`)} ·{" "}
                    {exercise.equipment.length === 0
                      ? t("equipment.none")
                      : exercise.equipment.map((item) => t(`equipment.${item}`)).join(", ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

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
