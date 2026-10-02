/**
 * Convertit la table Ciqual 2020 (XML officiel de l'Anses, licence ouverte Etalab 2.0)
 * en un CSV compact versionné dans le dépôt : `data/ciqual-2020.csv`.
 *
 * Usage : tsx scripts/ciqual/build-dataset.ts <dossier des XML dézippés> <fichier CSV de sortie>
 * Lancé par le workflow GitHub Actions « Données Ciqual » (le site de l'Anses n'est pas
 * joignable depuis tous les environnements).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CIQUAL_COLUMNS, ciqualHints, toCsvLine } from "./format";

const [inputDir, output] = process.argv.slice(2);
if (!inputDir || !output) {
  console.error("Usage : tsx scripts/ciqual/build-dataset.ts <dossier XML> <sortie.csv>");
  process.exit(1);
}

const decoder = new TextDecoder("windows-1252");
function readXml(prefix: string): string {
  const name = readdirSync(inputDir!).find((file) => file.startsWith(prefix) && file.endsWith(".xml"));
  if (!name) throw new Error(`Fichier ${prefix}*.xml introuvable dans ${inputDir}`);
  return decoder.decode(readFileSync(join(inputDir!, name)));
}

/** Enregistrements d'un fichier Ciqual (enfants de `<TABLE>`), champs nettoyés de leurs espaces. */
function records(xml: string): Record<string, string>[] {
  const tag = xml.match(/<TABLE>\s*<(\w+)>/)?.[1];
  if (!tag) return [];
  const result: Record<string, string>[] = [];
  for (const match of xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))) {
    const fields: Record<string, string> = {};
    for (const field of match[1]!.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      fields[field[1]!.toLowerCase()] = decodeEntities(field[2]!).trim();
    }
    result.push(fields);
  }
  return result;
}

function decodeEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

/** « 12,5 » → 12.5 ; « traces » → 0 ; « < 0,5 » → moitié du seuil ; « - » → null. */
function parseValue(raw: string | undefined): number | null {
  if (!raw || raw === "-") return null;
  if (raw.toLowerCase() === "traces") return 0;
  const below = raw.match(/^<\s*([\d,.]+)$/);
  if (below) return Number(below[1]!.replace(",", ".")) / 2;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

const CONST = { kcal: "328", kcalJones: "333", protein: "25000", proteinCrude: "25003" } as const;
const CONST_OTHER = { carbs: "31000", fat: "40000", fiber: "34100", sugars: "32000", salt: "10004" } as const;

const groups = new Map<string, string>();
for (const group of records(readXml("alim_grp"))) {
  const sub = group.alim_ssgrp_code;
  if (sub && group.alim_ssgrp_nom_fr && group.alim_ssgrp_nom_fr !== "-") groups.set(sub, group.alim_ssgrp_nom_fr);
  if (group.alim_grp_code && !groups.has(group.alim_grp_code))
    groups.set(group.alim_grp_code, group.alim_grp_nom_fr ?? "");
}

const values = new Map<string, Map<string, number | null>>();
for (const compo of records(readXml("compo"))) {
  const code = compo.alim_code!;
  if (!values.has(code)) values.set(code, new Map());
  values.get(code)!.set(compo.const_code!, parseValue(compo.teneur));
}

const lines = [CIQUAL_COLUMNS.join(",")];
let skipped = 0;
for (const alim of records(readXml("alim_2"))) {
  const code = alim.alim_code!;
  const v = values.get(code) ?? new Map<string, number | null>();
  const protein = v.get(CONST.protein) ?? v.get(CONST.proteinCrude) ?? null;
  const carbs = v.get(CONST_OTHER.carbs) ?? null;
  const fat = v.get(CONST_OTHER.fat) ?? null;
  let kcal = v.get(CONST.kcal) ?? v.get(CONST.kcalJones) ?? null;
  if (kcal === null && protein !== null && carbs !== null && fat !== null) kcal = protein * 4 + carbs * 4 + fat * 9;
  // Sans énergie ni macros, l'aliment n'est pas utilisable pour le suivi.
  if (kcal === null) {
    skipped += 1;
    continue;
  }
  const name = alim.alim_nom_fr!;
  const hints = ciqualHints(name, alim.alim_grp_code ?? "");
  lines.push(
    toCsvLine([
      code,
      name,
      alim.alim_nom_eng ?? "",
      groups.get(alim.alim_ssgrp_code ?? "") ?? groups.get(alim.alim_grp_code ?? "") ?? "",
      kcal,
      protein ?? 0,
      carbs ?? 0,
      fat ?? 0,
      v.get(CONST_OTHER.fiber) ?? "",
      v.get(CONST_OTHER.sugars) ?? "",
      v.get(CONST_OTHER.salt) ?? "",
      hints.densityGPerMl ?? "",
      hints.unitWeights ? JSON.stringify(hints.unitWeights) : "",
    ]),
  );
}

writeFileSync(output, `${lines.join("\n")}\n`);
console.log(`${lines.length - 1} aliments écrits dans ${output} (${skipped} ignorés sans énergie).`);
