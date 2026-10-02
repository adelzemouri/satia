import type { ActivityType } from "./activity";

/** Garde-fous de l'import : au-delà, le fichier est refusé. */
export const IMPORT_MAX_ROWS = 5000;
// Sous la limite de taille des actions serveur (2 Mo), en-têtes compris.
export const IMPORT_MAX_BYTES = 1_500_000;

export type ImportedActivity = { date: string; type: ActivityType; durationMin: number };

export type ParsedImport = {
  /** Pas par jour (les lignes d'un même jour s'additionnent). */
  steps: Map<string, number>;
  activities: ImportedActivity[];
  /** Lignes ignorées : date illisible, valeur absente ou hors bornes. */
  skipped: number;
};

/** Minuscules sans accents ni ponctuation, pour reconnaître les en-têtes et les types. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Découpe une ligne CSV en respectant les guillemets. */
export function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

/** Séparateur le plus présent dans l'en-tête : virgule, point-virgule ou tabulation. */
function detectSeparator(header: string): string {
  const counts = [",", ";", "\t"].map((separator) => [separator, header.split(separator).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]![0];
}

/** Date ISO depuis AAAA-MM-JJ (avec ou sans heure), AAAA/MM/JJ, JJ/MM/AAAA ou JJ.MM.AAAA. */
export function parseImportDate(raw: string): string | null {
  const text = raw.trim();
  let year: number, month: number, day: number;
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(text);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Durée en minutes : nombre (dans l'unité de la colonne) ou h:mm:ss / mm:ss. */
export function parseDuration(raw: string, unit: "min" | "s" | "ms" | "h"): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  if (text.includes(":")) {
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    const [h, m, s] = parts.length === 3 ? parts : [0, parts[0]!, parts[1]!];
    return h! * 60 + m! + s! / 60;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return { min: value, s: value / 60, ms: value / 60_000, h: value * 60 }[unit];
}

const TYPE_KEYWORDS: [RegExp, ActivityType][] = [
  [/rando|hik|trek/, "hiking"],
  [/run|jog|footing|course|trail/, "running"],
  [/walk|march|pied/, "walking"],
  [/bik|cycl|velo|spinning/, "cycling"],
  [/swim|nat|piscine/, "swimming"],
  [/dans|danc|zumba/, "dancing"],
  [/yoga|pilates|stretch|etirement/, "yoga"],
  [/tennis|badminton|squash|padel|ping|racket|raquette/, "racket_sport"],
  [/foot|soccer|basket|hand|rugby|volley/, "team_sport"],
  [/climb|escalade|bloc/, "climbing"],
  [/ski|snowboard/, "skiing"],
  [/strength|muscu|weight|halter|crossfit|renfo/, "strength"],
  [/garden|jardin/, "gardening"],
  [/menage|house|clean/, "housework"],
];

/** Type d'activité reconnu dans un libellé d'export (Google Fit, Apple Santé, montre…). */
export function mapActivityType(label: string): ActivityType {
  const text = normalize(label);
  return TYPE_KEYWORDS.find(([pattern]) => pattern.test(text))?.[1] ?? "other";
}

type Columns = {
  date: number;
  steps: number;
  type: number;
  duration: number;
  durationUnit: "min" | "s" | "ms" | "h";
};

function findColumns(header: string[]): Columns {
  const names = header.map(normalize);
  const find = (pattern: RegExp) => names.findIndex((name) => pattern.test(name));
  // « Move minutes » (Google Fit) recoupe les pas : ce n'est pas une séance.
  const duration = find(/^(?!.*move).*(dur|minute|temps|active time)/);
  const durationName = names[duration] ?? "";
  return {
    date: find(/date|jour|day|debut|start/),
    steps: find(/step|\bpas\b|nombre de pas/),
    type: find(/type|activit|sport|workout|exercice/),
    duration,
    durationUnit: /\(ms\)|millis/.test(durationName)
      ? "ms"
      : /\(s\)|sec/.test(durationName)
        ? "s"
        : /\(h\)|heure|hour/.test(durationName)
          ? "h"
          : "min",
  };
}

/**
 * Lit un export CSV de pas ou d'activités. Les colonnes sont reconnues par leur en-tête
 * (français ou anglais) : date, pas, type d'activité, durée. Une ligne peut porter des pas,
 * une activité, ou les deux. Lève `import_invalid` sans colonne de date exploitable.
 */
export function parseActivityCsv(text: string, today: string): ParsedImport {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  const result: ParsedImport = { steps: new Map(), activities: [], skipped: 0 };
  if (lines.length < 2) throw new Error("import_invalid");
  if (lines.length - 1 > IMPORT_MAX_ROWS) throw new Error("import_too_large");
  const separator = detectSeparator(lines[0]!);
  const columns = findColumns(splitCsvLine(lines[0]!, separator));
  if (columns.date < 0 || (columns.steps < 0 && columns.duration < 0)) throw new Error("import_invalid");

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, separator);
    const date = parseImportDate(cells[columns.date] ?? "");
    if (!date || date > today) {
      result.skipped++;
      continue;
    }
    let used = false;
    const steps = columns.steps >= 0 ? Number((cells[columns.steps] ?? "").replace(/[\s ]/g, "")) : NaN;
    if (Number.isInteger(steps) && steps > 0 && steps <= 100_000) {
      result.steps.set(date, Math.min(100_000, (result.steps.get(date) ?? 0) + steps));
      used = true;
    }
    const duration = columns.duration >= 0 ? parseDuration(cells[columns.duration] ?? "", columns.durationUnit) : null;
    if (duration !== null && duration >= 1 && duration <= 600) {
      const label = columns.type >= 0 ? (cells[columns.type] ?? "") : "";
      result.activities.push({ date, type: mapActivityType(label), durationMin: Math.round(duration) });
      used = true;
    }
    if (!used) result.skipped++;
  }
  return result;
}
