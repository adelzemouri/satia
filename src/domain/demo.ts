import { addDays } from "./energy";
import type { ActivityType, Intensity } from "./activity";
import type { MealSlot } from "./meals";
import { seededRandom } from "./recipes/dish-art";
import type { Unit } from "./units";

/**
 * Compte de démonstration : un profil fictif (« Camille ») et quelques semaines d'historique
 * crédible, générés de façon déterministe à partir de la date du jour. Calcul pur : le serveur
 * (`server/demo.ts`) retrouve les aliments et écrit en base.
 */

export const DEMO_EMAIL = "demo@pommelia.fr";
export const DEMO_HOUSEHOLD_NAME = "Démo";
/** Jours d'historique avant aujourd'hui. */
export const DEMO_DAYS = 35;

export const DEMO_PROFILE = {
  firstName: "Camille",
  sex: "female",
  birthDate: "1991-05-14",
  heightCm: 168,
  startWeightKg: 72,
  targetWeightKg: 66,
  goal: "lose_weight",
  activityLevel: 2,
  pace: "gentle",
  diet: "flexitarian",
} as const;

/** Aliment de la base : recette du catalogue (par slug) ou aliment Ciqual (par code). */
export type DemoFoodRef = { recipe: string } | { ciqual: string };

export type DemoEntry = {
  date: string;
  slot: MealSlot;
  food: DemoFoodRef;
  quantity: number;
  unit: Unit;
};

export type DemoData = {
  start: string;
  entries: DemoEntry[];
  weights: { date: string; weightKg: number }[];
  water: { date: string; glasses: number }[];
  checkins: { date: string; hunger: number; energy: number; mood: number }[];
  activities: { date: string; type: ActivityType; intensity: Intensity; durationMin: number }[];
  steps: { date: string; steps: number }[];
};

const BREAKFASTS = [
  "porridge-pomme-cannelle",
  "bol-fromage-blanc-fruits-rouges",
  "overnight-oats-mangue",
  "tartines-avocat-oeuf",
  "pancakes-banane",
  "omelette-epinards-feta",
];
const MAINS = [
  "poulet-riz-brocoli-citron",
  "saumon-patate-douce-haricots",
  "chili-sin-carne",
  "dahl-lentilles-corail",
  "pates-bolognaise-legumes",
  "curry-pois-chiches-coco",
  "gratin-courgettes-chevre",
  "papillote-cabillaud-legumes",
  "poelee-dinde-poivrons",
  "quiche-poireaux-legere",
  "risotto-champignons",
  "hachis-parmentier-leger",
  "wok-crevettes-nouilles",
  "bowl-quinoa-legumes-rotis",
  "tofu-saute-legumes-riz",
  "poulet-roti-legumes",
  "lasagnes-legumes",
];
const SALADS = [
  "salade-lentilles-carottes",
  "salade-grecque",
  "salade-pates-poulet",
  "salade-thon-riz-mais",
  "salade-quinoa-feta-concombre",
  "taboule-libanais",
];
const SOUPS = ["veloute-potiron", "minestrone", "veloute-carottes-cumin", "soupe-lentilles-vertes"];
const SNACK_RECIPES = [
  "yaourt-miel-noix",
  "pomme-beurre-cacahuete",
  "houmous-batonnets",
  "boules-energie-dattes",
  "salade-fruits-menthe",
  "crumble-pommes-avoine",
];

const CIQUAL = {
  coffeeWithMilk: "18151",
  apple: "13039",
  banana: "13005",
  kiwi: "13021",
  clementine: "13024",
  almonds: "15000",
  wholemealBread: "7110",
  plainYogurt: "19593",
} as const;

const FRUITS = [CIQUAL.apple, CIQUAL.banana, CIQUAL.kiwi, CIQUAL.clementine];

/** Repas du jour, dans l'ordre de la journée, avec l'heure à partir de laquelle on les a « mangés ». */
export const DEMO_SLOT_TIMES: readonly { slot: MealSlot; time: string }[] = [
  { slot: "breakfast", time: "07:30" },
  { slot: "lunch", time: "12:30" },
  { slot: "snack", time: "16:30" },
  { slot: "dinner", time: "19:30" },
];

/** Repas déjà passés à l'heure `time` (« HH:MM »). Le petit-déjeuner est toujours là. */
export function demoSlotsBefore(time: string): MealSlot[] {
  return DEMO_SLOT_TIMES.filter((row, i) => i === 0 || row.time <= time).map((row) => row.slot);
}

/** Historique de démonstration se terminant aujourd'hui (petit-déjeuner du jour seulement). */
export function demoData(today: string, seed = "pommelia-demo"): DemoData {
  const random = seededRandom(seed);
  const start = addDays(today, -DEMO_DAYS);
  // Deux jours sans saisie dans les semaines anciennes : un historique réel n'est jamais parfait.
  const skipped = new Set([
    addDays(today, -(18 + Math.floor(random() * 6))),
    addDays(today, -(28 + Math.floor(random() * 5))),
  ]);
  return demoDays({ start, from: start, today, todaySlots: ["breakfast"], skipped, seed });
}

/**
 * Journées de démonstration du `from` au `today` inclus. Chaque jour a son propre tirage
 * (graine + date) : une journée est la même qu'on la crée à la réinitialisation ou plus tard
 * pour combler un trou. Le poids suit une pente douce depuis `start`, le début de l'historique.
 * Pour aujourd'hui, seuls les repas `todaySlots` sont saisis.
 */
export function demoDays(options: {
  start: string;
  from: string;
  today: string;
  todaySlots: readonly MealSlot[];
  skipped?: ReadonlySet<string>;
  seed?: string;
}): DemoData {
  const { start, from, today, todaySlots, skipped = new Set<string>(), seed = "pommelia-demo" } = options;
  const data: DemoData = { start, entries: [], weights: [], water: [], checkins: [], activities: [], steps: [] };

  // Environ 0,4 kg perdu par semaine, avec les variations d'un jour à l'autre.
  const weeklyLoss = 0.4;
  for (let date = from; date <= today; date = addDays(date, 1)) {
    const random = seededRandom(`${seed}:${date}`);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
    const chance = (p: number) => random() < p;
    const round = (value: number, step: number) => Math.round(value / step) * step;
    const entries: DemoEntry[] = [];
    const add = (slot: MealSlot, food: DemoFoodRef, quantity = 1, unit: Unit = "portion") =>
      entries.push({ date, slot, food, quantity, unit });

    const elapsedDays = Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000);
    const isToday = date === today;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;

    const noise = random();
    if (elapsedDays % 3 === 0 || isToday) {
      const trend = DEMO_PROFILE.startWeightKg - (weeklyLoss * elapsedDays) / 7;
      data.weights.push({ date, weightKg: round(trend + (noise - 0.5) * 0.6, 0.1) });
    }

    if (skipped.has(date)) continue;

    // Petit-déjeuner
    if (weekend && chance(0.5)) add("breakfast", { recipe: "pancakes-banane" });
    else add("breakfast", { recipe: pick(BREAKFASTS) });
    if (chance(0.7)) add("breakfast", { ciqual: CIQUAL.coffeeWithMilk }, 200, "ml");

    // Déjeuner : un plat ou une salade (parfois une portion et demie), du pain, un yaourt ou un fruit
    add("lunch", { recipe: chance(0.35) ? pick(SALADS) : pick(MAINS) }, pick([1, 1, 1.5]));
    if (chance(0.5)) add("lunch", { ciqual: CIQUAL.wholemealBread }, 1, "slice");
    if (chance(0.5)) add("lunch", { ciqual: CIQUAL.plainYogurt }, 1, "piece");
    else add("lunch", { ciqual: pick(FRUITS) }, 1, "piece");

    // Dîner : une soupe avec du pain et un dessert, ou un plat
    if (chance(0.3)) {
      add("dinner", { recipe: pick(SOUPS) }, pick([1, 1.5]));
      add("dinner", { ciqual: CIQUAL.wholemealBread }, 2, "slice");
      add("dinner", { recipe: pick(SNACK_RECIPES) });
    } else {
      add("dinner", { recipe: pick(MAINS) }, pick([1, 1.5]));
      if (chance(0.4)) add("dinner", { ciqual: pick(FRUITS) }, 1, "piece");
    }

    // Collation l'après-midi, parfois deux
    if (chance(0.5)) add("snack", { recipe: pick(SNACK_RECIPES) });
    else add("snack", { ciqual: CIQUAL.almonds }, 20, "g");
    if (chance(0.4)) add("snack", { ciqual: pick(FRUITS) }, 1, "piece");

    const glasses = 5 + Math.floor(random() * 5);

    if (isToday) {
      data.entries.push(...entries.filter((entry) => todaySlots.includes(entry.slot)));
      data.water.push({ date, glasses: Math.min(glasses, 2 * todaySlots.length) });
      break;
    }
    data.entries.push(...entries);
    data.water.push({ date, glasses });

    if (chance(0.75)) {
      data.checkins.push({
        date,
        hunger: 2 + Math.floor(random() * 3),
        energy: 3 + Math.floor(random() * 3),
        mood: 3 + Math.floor(random() * 3),
      });
    }

    if (weekday === 2 || weekday === 4) {
      data.activities.push({ date, type: "walking", intensity: "moderate", durationMin: round(30 + random() * 20, 5) });
    } else if (weekday === 6) {
      data.activities.push({ date, type: "yoga", intensity: "light", durationMin: 45 });
    } else if (weekday === 0 && chance(0.5)) {
      data.activities.push({ date, type: "cycling", intensity: "light", durationMin: round(40 + random() * 40, 5) });
    }

    data.steps.push({ date, steps: round(4500 + random() * 6000, 10) });
  }
  return data;
}

/** Échange déjà passé avec le coach, pour que la conversation ne s'ouvre pas sur une page vide. */
export const DEMO_COACH_MESSAGES: readonly { role: "user" | "coach"; content: string }[] = [
  { role: "user", content: "Le soir en semaine je manque d'idées et de temps. Tu as des pistes ?" },
  {
    role: "coach",
    content:
      "Bonne question ! Vise des plats prêts en 20 minutes que tu peux doubler : un dahl de lentilles corail se garde trois jours au frais, une papillote de cabillaud cuit pendant que tu fais autre chose. Le dimanche, une grande soupe de légumes te fait deux dîners avec une tranche de pain complet et un fruit.",
  },
  { role: "user", content: "Et quand j'ai faim vers 17 h ?" },
  {
    role: "coach",
    content:
      "C'est très courant, surtout si le déjeuner est léger. Une collation avec des protéines ou des fibres tient mieux : un yaourt nature avec quelques noix, une pomme avec un peu de beurre de cacahuète, ou une poignée d'amandes. Tu arriveras au dîner plus sereinement.",
  },
];
