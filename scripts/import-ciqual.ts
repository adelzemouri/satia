/**
 * Charge `data/ciqual-2020.csv` dans la table `foods` (source « ciqual »).
 * Idempotent : ne fait rien si le fichier n'a pas changé depuis le dernier import.
 * Lancé avant chaque build de déploiement, après les migrations.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import postgres from "postgres";

import { normalizeForSearch } from "../src/domain/search";
import { CIQUAL_COLUMNS, parseCsvLine } from "./ciqual/format";

const FILE = "data/ciqual-2020.csv";
const SETTING_KEY = "ciqual_dataset_sha256";
const BATCH = 500;

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");
if (!existsSync(FILE)) {
  console.log(`${FILE} absent : import Ciqual ignoré.`);
  process.exit(0);
}

const content = readFileSync(FILE, "utf8");
const hash = createHash("sha256").update(content).digest("hex");
const sql = postgres(url, { max: 1 });

try {
  const [current] = await sql<
    { value: string }[]
  >`select value #>> '{}' as value from app_settings where key = ${SETTING_KEY}`;
  const [counted] = await sql<{ count: number }[]>`select count(*)::int as count from foods where source = 'ciqual'`;
  if (current?.value === hash && (counted?.count ?? 0) > 0) {
    console.log("Table Ciqual déjà à jour.");
  } else {
    const [header, ...lines] = content.trim().split("\n");
    if (header !== CIQUAL_COLUMNS.join(",")) throw new Error(`En-tête inattendu dans ${FILE}`);
    const rows = lines.map((line) => {
      const f = Object.fromEntries(CIQUAL_COLUMNS.map((column, i) => [column, parseCsvLine(line)[i] ?? ""]));
      const num = (value: string) => (value === "" ? null : Number(value));
      return {
        source: "ciqual",
        source_ref: f.code!,
        name_fr: f.name_fr!,
        name_en: f.name_en || null,
        group_fr: f.group_fr || null,
        search_name: normalizeForSearch(f.name_fr!),
        kcal: Number(f.kcal),
        protein_g: Number(f.protein_g),
        carbs_g: Number(f.carbs_g),
        fat_g: Number(f.fat_g),
        fiber_g: num(f.fiber_g!),
        sugars_g: num(f.sugars_g!),
        salt_g: num(f.salt_g!),
        density_g_per_ml: num(f.density_g_ml!),
        unit_weights: f.unit_weights ? JSON.parse(f.unit_weights) : null,
      };
    });

    await sql.begin(async (tx) => {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await tx`
          insert into foods ${tx(batch)}
          on conflict (source, source_ref) do update set
            name_fr = excluded.name_fr, name_en = excluded.name_en, group_fr = excluded.group_fr,
            search_name = excluded.search_name, kcal = excluded.kcal, protein_g = excluded.protein_g,
            carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, fiber_g = excluded.fiber_g,
            sugars_g = excluded.sugars_g, salt_g = excluded.salt_g,
            density_g_per_ml = excluded.density_g_per_ml, unit_weights = excluded.unit_weights,
            updated_at = now()
        `;
      }
      await tx`
        insert into app_settings (key, value) values (${SETTING_KEY}, ${tx.json(hash)})
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
    });
    console.log(`${rows.length} aliments Ciqual importés.`);
  }
} finally {
  await sql.end();
}
