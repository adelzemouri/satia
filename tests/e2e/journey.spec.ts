import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

import { totp } from "./totp";

/**
 * Parcours critiques de la phase 1, dans l'ordre réel d'utilisation :
 * installation → onboarding → 2FA → invitation d'un membre → réinitialisation → export → suppression.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { email: "adel@example.com", password: "mot-de-passe-admin-1" };
const TEEN = { email: "lea@example.com", password: "mot-de-passe-lea-1" };
let totpSecret = "";
let inviteUrl = "";

/** Message d'alerte de l'application (hors annonceur de navigation de Next.js). */
function alertIn(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/**
 * Lance une action dont l'affichage est optimiste et attend la réponse de l'action serveur,
 * pour qu'un rechargement juste après relise bien la valeur enregistrée.
 */
async function withServerAction(page: Page, act: () => Promise<unknown>) {
  const done = page.waitForResponse(
    (response) => response.request().method() === "POST" && !!response.request().headers()["next-action"],
  );
  await act();
  await done;
}

async function expectNoA11yViolations(page: Page) {
  // Après une action serveur, le titre (métadonnées en streaming) peut disparaître un instant
  // pendant le rafraîchissement : on réanalyse jusqu'à une page stable (une vraie erreur reste).
  await expect(async () => {
    await expect(page).toHaveTitle(/\S/);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }).toPass({ timeout: 10_000 });
}

async function submitLogin(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(credentials.email);
  await page.getByLabel("Mot de passe").fill(credentials.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await submitLogin(page, credentials);
  await expect(page).not.toHaveURL(/\/login$/);
}

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test("installation du foyer et du compte admin", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Jeton d'installation").fill("mauvais-jeton");
  await page.getByLabel("Nom du foyer").fill("Famille Z.");
  await page.getByLabel("Prénom ou surnom").fill("Adel");
  await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
  await page.getByLabel("Mot de passe").fill(ADMIN.password);
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await expect(alertIn(page)).toHaveText("Jeton d'installation incorrect.");

  await page.getByLabel("Jeton d'installation").fill(process.env.SETUP_TOKEN!);
  await page.getByLabel("Mot de passe").fill(ADMIN.password);
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Une fois installé, la page d'installation n'est plus accessible.
  const other = await newPage(page.context().browser()!);
  await other.goto("/setup");
  await expect(other).toHaveURL(/\/login$/);
});

test("onboarding complet d'un adulte avec plan expliqué", async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/\/onboarding$/);
  const next = page.getByRole("button", { name: "Continuer" });

  // Six écrans regroupés, présentés par Pépin, sans barre d'onglets pour partir en cours de route.
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await expect(page.getByLabel("Prénom")).toHaveValue("Adel");
  await page.getByLabel("Homme").check();
  await page.getByLabel("Date de naissance").fill("1988-04-12");
  await next.click();
  await page.getByLabel("Taille en cm").fill("178");
  await page.getByLabel("Poids en kg").fill("25");
  await next.click();
  await expect(page.getByText("Indique un poids entre 30 et 300 kg.")).toBeVisible();
  await page.getByLabel("Poids en kg").fill("82,5");
  await next.click();
  await page.getByLabel("Perdre du poids").check();
  await page.getByLabel("Poids cible en kg").fill("55");
  await next.click();
  await expect(page.getByText(/On préfère ne pas viser en dessous de 58,7 kg/)).toBeVisible();
  await page.getByLabel("Poids cible en kg").fill("77");
  await next.click();
  await page.getByLabel("Un peu actif").check();
  await expect(page.getByText(/Environ 0,25 kg par semaine · Objectif estimé vers le/)).toBeVisible();
  await page.getByLabel("Doux").check();
  await next.click();
  // « Omnivore » est déjà coché : on peut le changer.
  await expect(page.getByLabel("Omnivore")).toBeChecked();
  await page.getByLabel("Sans porc").check();
  await page.getByLabel("Aliments que tu préfères éviter").fill("coriandre");
  await next.click(); // horaires par défaut
  await next.click();
  await expect(alertIn(page)).toHaveText("Merci de confirmer avoir lu ce message.");
  await page.getByLabel("J'ai compris").check();
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ton plan de départ");
  await expect(page.getByText(/formule de Mifflin-St Jeor/)).toBeVisible();
  await expect(page.getByText(/s'affinera automatiquement après deux semaines/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "C'est parti !" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel");
  await expect(page.getByText("kcal restantes", { exact: true })).toBeVisible();
  await expect(page.getByText("Protéines", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("le thème choisi dans le profil est appliqué et conservé", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.getByRole("link", { name: "Moi", exact: true }).click();
  await page.getByRole("link", { name: /^Préférences/ }).click();
  await page.getByText("Sombre").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoA11yViolations(page);
});

test("sur ordinateur, une barre latérale remplace la barre du bas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, ADMIN);
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toHaveCount(1);
  await nav.getByRole("link", { name: "Journal" }).click();
  await expect(page).toHaveURL(/\/journal/);
  await expect(nav.getByRole("link", { name: "Journal" })).toHaveAttribute("aria-current", "page");
  // La barre latérale remplace aussi le bouton « Retour » des pages secondaires.
  await page.goto("/weight");
  await expect(page.getByRole("link", { name: "Retour" })).toHaveCount(0);
  await page.setViewportSize({ width: 412, height: 800 });
  await expect(page.getByRole("link", { name: "Retour" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("n");
  await expect(page).toHaveURL(/\/add$/);
  await expectNoA11yViolations(page);
});

test("réglages des notifications et génération des clés côté admin", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/profile/notifications");
  const card = page.getByRole("main");
  await expect(card.getByText("Les notifications ne sont pas encore configurées par l'admin.")).toBeVisible();
  await expect(card.getByLabel("Repas non saisis")).toBeChecked();
  await card.getByLabel("Hydratation").uncheck();
  await card.getByLabel("De", { exact: true }).fill("21:30");
  await card.getByRole("button", { name: "Enregistrer" }).click();
  await expect(card.getByText("Préférences enregistrées.")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.reload();
  await expect(card.getByLabel("Hydratation")).not.toBeChecked();
  await expect(card.getByLabel("De", { exact: true })).toHaveValue("21:30");

  await page.goto("/admin");
  const push = page.getByRole("region", { name: "Notifications" });
  await push.getByRole("button", { name: "Générer une paire de clés" }).click();
  await expect(push.getByText("VAPID_PUBLIC_KEY")).toBeVisible();
  await expect(push.getByText("VAPID_PRIVATE_KEY")).toBeVisible();
  await expect(push.locator("code").first()).toHaveText(/^[A-Za-z0-9_-]{87}$/);
  await expectNoA11yViolations(page);
});

test("ajout manuel d'un repas depuis la base Ciqual", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.getByRole("link", { name: "Ajouter au déjeuner" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajouter");
  await expect(page.getByLabel("Pour quel repas ?")).toHaveValue("lunch");
  const search = page.getByLabel("Rechercher un aliment");
  await search.fill("poire");
  // La croix vide le champ sans lui faire perdre le focus (le clavier reste ouvert).
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(page.getByRole("button", { name: "Effacer la recherche" })).toHaveCount(0);
  await search.fill("pomme crue");
  const result = page.getByRole("button", { name: /^Pomme, pulpe et peau, crue/ }).first();
  await expect(result).toBeVisible();
  await expectNoA11yViolations(page);
  await result.click();

  await expect(page.getByRole("heading", { name: "Combien ?" })).toBeVisible();
  await page.getByLabel("Unité").selectOption("g");
  await page.getByLabel("Quantité").fill("200");
  await expect(page.getByText(/Ça fait \d+ kcal/)).toBeVisible();
  await page.getByRole("button", { name: "Ajouter au journal" }).click();

  await expect(page).toHaveURL(/\/journal\?date=/);
  const lunch = page.getByRole("region", { name: "Déjeuner" });
  await expect(lunch.getByText(/^Pomme, pulpe et peau, crue/)).toBeVisible();
  await expect(lunch.getByText("200 g", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);

  // Modifier la quantité met les valeurs à jour.
  await lunch.getByRole("button", { name: /^Modifier Pomme, pulpe et peau, crue/ }).click();
  await lunch.getByLabel("Quantité").fill("100");
  await lunch.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(lunch.getByRole("button", { name: /^Modifier Pomme, pulpe et peau, crue/ })).toContainText(
    /100 g5\d kcal/,
  );

  await page.getByRole("link", { name: "Accueil" }).click();
  await expect(page.getByRole("progressbar", { name: /kcal consommées/ })).not.toHaveAttribute("aria-valuenow", "0");
  // L'anneau du déjeuner affiche les calories du créneau sur sa part de l'objectif et ouvre son détail.
  await expect(page.getByRole("link", { name: "Voir le déjeuner" })).toContainText(/^Déjeuner5\d \/ \d/);
  await expect(page.getByRole("link", { name: /1 jour d'affilée/ })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("link", { name: "Voir le déjeuner" }).click();
  await expect(page).toHaveURL(/\/journal\?date=.*#slot-lunch$/);
  await expect(page.getByRole("region", { name: "Déjeuner" }).getByText(/^Pomme, pulpe et peau, crue/)).toBeVisible();
});

test("recette : l'ordre des ingrédients se change pendant la modification", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/foods/new-recipe");
  await page.getByLabel("Nom", { exact: true }).fill("Salade de pâtes");
  for (const [query, name] of [
    ["pâtes cuites", /^Pâtes/],
    ["pomme crue", /^Pomme, pulpe et peau, crue/],
  ] as const) {
    await page.getByLabel("Ajouter un ingrédient").fill(query);
    await page.getByRole("button", { name }).first().click();
  }
  const ingredients = page.getByRole("group", { name: "Ingrédients" }).getByRole("listitem");
  await expect(ingredients).toHaveCount(2);
  // Les longs noms Ciqual proposés ne font pas déborder le formulaire sur téléphone.
  await page.getByLabel("Ajouter un ingrédient").fill("crème liquide");
  await expect(page.getByRole("button", { name: /^Crème de lait.*fluide/ }).first()).toBeVisible();
  const fits = await page
    .getByRole("group", { name: "Ingrédients" })
    .evaluate((el) => el.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + 1);
  expect(fits).toBe(true);
  await page.getByLabel("Ajouter un ingrédient").fill("");
  await expect(page.getByRole("button", { name: /^Monter Pâtes/ })).toBeDisabled();
  await page.getByRole("button", { name: /^Monter Pomme/ }).click();
  await expect(ingredients.first()).toContainText("Pomme");
  await expect(page.getByRole("button", { name: /^Monter Pomme/ })).toBeDisabled();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Créer" }).click();
  // Toute recette est commune à la famille : on la retrouve dans les recettes.
  await expect(page).toHaveURL(/\/recipes$/);

  await page.getByRole("link", { name: /^Salade de pâtes \d/ }).click();
  const card = page.getByRole("region", { name: "Ingrédients" }).getByRole("listitem");
  await expect(card.first()).toContainText("Pomme");
  // En modification, on redescend la pomme : la fiche suit le nouvel ordre.
  await page.getByRole("link", { name: "Modifier la recette" }).click();
  await page.getByRole("button", { name: /^Descendre Pomme/ }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.getByRole("link", { name: /^Salade de pâtes \d/ }).click();
  await expect(card.first()).toContainText("Pâtes");
  await expect(card.last()).toContainText("Pomme");
});

test("aliment personnel, favori, eau et poids", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/foods/new");
  await page.getByLabel("Nom", { exact: true }).fill("Granola maison");
  await page.getByLabel("Pour une portion").check();
  await page.getByLabel("Poids d'une portion (g)").fill("50");
  await page.getByLabel("Protéines (g)").fill("5");
  await page.getByLabel("Glucides (g)").fill("30");
  await page.getByLabel("Lipides (g)").fill("8");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page).toHaveURL(/\/foods$/);
  await expect(page.getByText("Granola maison")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un repas" }).click();
  await page.getByRole("link", { name: "Chercher", exact: true }).click();
  await page.getByRole("tab", { name: "Mes aliments" }).click();
  await page.getByRole("button", { name: "Ajouter Granola maison aux favoris" }).click();
  await page.getByRole("tab", { name: "Favoris" }).click();
  await page.getByRole("button", { name: /^Granola maison/ }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("portion");
  // Valeurs saisies pour une portion, énergie calculée depuis les macros : 5 × 4 + 30 × 4 + 8 × 9.
  await expect(page.getByText("Ça fait 212 kcal")).toBeVisible();
  await page.locator('select[name="slot"]').selectOption("breakfast");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText("Granola maison")).toBeVisible();

  // Le + des récents rajoute la dernière portion d'un geste.
  await page.getByRole("button", { name: "Ajouter un repas" }).click();
  await page.getByRole("link", { name: "Chercher", exact: true }).click();
  await expect(page.getByText("1 portion · 212 kcal")).toBeVisible();
  await withServerAction(page, () => page.getByRole("button", { name: "Ajouter Granola maison" }).click());
  await expect(page.getByRole("button", { name: "Granola maison ajouté" })).toBeVisible();
  // Un message propose d'annuler l'ajout.
  const added = page.getByRole("status").filter({ hasText: "Ajouté : Granola maison" });
  await withServerAction(page, () => added.getByRole("button", { name: "Annuler" }).click());
  await expect(page.getByRole("button", { name: "Ajouter Granola maison" })).toBeVisible();

  // Une suppression dans le journal s'annule aussi : la ligne revient et reste après rechargement.
  await page.goto("/journal");
  const breakfast = page.getByRole("region", { name: "Petit-déjeuner" });
  await breakfast.getByRole("button", { name: "Modifier Granola maison" }).click();
  await breakfast.getByRole("button", { name: "Supprimer" }).click();
  await expect(breakfast.getByText("Granola maison")).toHaveCount(0);
  await page
    .getByRole("status")
    .filter({ hasText: "Supprimé : Granola maison" })
    .getByRole("button", { name: "Annuler" })
    .click();
  await expect(breakfast.getByText("Granola maison")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText("Granola maison")).toBeVisible();

  // Au doigt, glisser la ligne vers la gauche la supprime (toujours annulable).
  const row = page
    .getByRole("region", { name: "Petit-déjeuner" })
    .getByRole("button", { name: "Modifier Granola maison" });
  await row.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const fire = (type: string, x: number) =>
      element.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", clientX: x, clientY: y }),
      );
    fire("pointerdown", box.right - 20);
    for (const step of [10, 40, 80, 120, 160]) fire("pointermove", box.right - 20 - step);
    fire("pointerup", box.right - 180);
  });
  const swiped = page.getByRole("status").filter({ hasText: "Supprimé : Granola maison" });
  await expect(swiped).toBeVisible();
  await swiped.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText("Granola maison")).toBeVisible();

  // « Mes repas » : le petit-déjeuner s'enregistre sous un nom, puis se resert d'un geste.
  // Les actions moins fréquentes d'un repas sont dans son menu « ⋯ ».
  await page.getByRole("button", { name: "Plus d'actions pour le petit-déjeuner" }).click();
  const morning = page.getByRole("dialog", { name: "Petit-déjeuner" });
  await expectNoA11yViolations(page);
  await morning.getByRole("button", { name: "Enregistrer ce repas" }).click();
  await expect(morning.getByLabel("Nom du repas")).toHaveValue("Granola maison");
  await morning.getByLabel("Nom du repas").fill("Petit-déj du matin");
  await withServerAction(page, () => morning.getByRole("button", { name: "Enregistrer", exact: true }).click());
  await expect(morning).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Repas enregistré" })).toBeVisible();
  await page.goto("/add?slot=snack");
  const savedList = page.getByRole("region", { name: "Mes repas" });
  await expect(savedList.getByText("1 aliment · 212 kcal")).toBeVisible();
  await withServerAction(page, () => savedList.getByRole("button", { name: "Ajouter Petit-déj du matin" }).click());
  await expect(savedList.getByRole("button", { name: "Petit-déj du matin ajouté" })).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByRole("region", { name: "Collations" }).getByText("Granola maison")).toBeVisible();
  await page.goto("/meals");
  await expect(page.getByText("Petit-déj du matin")).toBeVisible();
  // Un repas enregistré se modifie : nom et quantités.
  await page.getByRole("link", { name: "Modifier Petit-déj du matin" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modifier le repas");
  await page.getByLabel("Nom du repas").fill("Grand petit-déj");
  await page.getByRole("textbox", { name: "Granola maison" }).fill("2");
  await expect(page.getByText("Total : 424 kcal")).toBeVisible();
  await expectNoA11yViolations(page);
  await withServerAction(page, () => page.getByRole("button", { name: "Enregistrer les modifications" }).click());
  await expect(page).toHaveURL(/\/meals$/);
  await expect(page.getByText("Grand petit-déj")).toBeVisible();
  // Chaque carte montre ses calories dans l'anneau et la répartition des macros.
  await expect(
    page.getByRole("img", { name: /^424 kcal : protéines \d+ %, glucides \d+ %, lipides \d+ %$/ }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Répartition des macros" }).getByText("Protéines")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter Grand petit-déj" })).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  // Sur l'accueil comme dans le journal, toucher un verre fixe le total du jour.
  const glass = (n: number) => page.getByRole("button", { name: `Verre ${n}`, exact: true });
  await withServerAction(page, () => glass(3).click());
  await expect(page.getByText("3 / 8 verres")).toBeVisible();
  // Retoucher le dernier verre plein le retire.
  await withServerAction(page, () => glass(3).click());
  await expect(page.getByText("2 / 8 verres")).toBeVisible();
  await withServerAction(page, () => glass(3).click());
  await page.reload();
  await expect(page.getByText("3 / 8 verres")).toBeVisible();

  // L'eau notée dans un repas compte aussi dans le compteur.
  await page.goto("/add?slot=lunch");
  await page.getByLabel("Rechercher un aliment").fill("eau du robinet");
  await page
    .getByRole("button", { name: /^Eau du robinet/ })
    .first()
    .click();
  await page.getByLabel("Unité").selectOption("ml");
  await page.getByLabel("Quantité").fill("500");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Déjeuner" }).getByText(/^Eau du robinet/)).toBeVisible();
  await expect(page.getByText("5 / 8 verres")).toBeVisible();
  await expect(page.getByText("dont 2 verres dans tes repas")).toBeVisible();
  await page.getByRole("link", { name: "Accueil" }).click();
  await expect(page.getByText("5 / 8 verres")).toBeVisible();
  // Retirer un verre ne touche qu'aux verres ajoutés au compteur, pas à l'eau du repas.
  await withServerAction(page, () => glass(5).click());
  await page.reload();
  await expect(page.getByText("4 / 8 verres")).toBeVisible();
  await withServerAction(page, () => glass(1).click());
  await page.reload();
  await expect(page.getByText("2 / 8 verres")).toBeVisible();

  await page.getByRole("link", { name: "Progrès" }).click();
  await page.getByRole("link", { name: /^Mon poids/ }).click();
  // Le poids est flouté par défaut : on l'affiche pour la suite.
  await expect(page.getByLabel("Poids en kg")).toHaveValue("");
  await page.getByRole("button", { name: "Afficher mon poids" }).first().click();
  // Masquer depuis un bloc refloute tout ; on réaffiche pour la suite.
  await page.getByRole("button", { name: "Masquer mon poids" }).first().click();
  await expect(page.getByRole("button", { name: "Masquer mon poids" })).toHaveCount(0);
  await page.getByRole("button", { name: "Afficher mon poids" }).first().click();
  await page.getByLabel("Poids en kg").fill("82");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Tendance actuelle : 82 kg")).toBeVisible();
  await expect(page.getByText(/Encore quelques pesées/)).toBeVisible();

  // L'objectif de poids se modifie ici, avec le même garde-fou qu'à l'inscription.
  const goal = page.getByLabel("Poids visé (kg)");
  await expect(goal).toHaveValue("77");
  await goal.fill("50");
  await page.getByRole("button", { name: "Enregistrer l'objectif" }).click();
  await expect(page.getByText(/On préfère ne pas viser en dessous de/)).toBeVisible();
  await goal.fill("75,5");
  await page.getByRole("button", { name: "Enregistrer l'objectif" }).click();
  await expect(page.getByText("Objectif de poids enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Poids visé (kg)")).toHaveValue("75.5");
  await expectNoA11yViolations(page);
});

test("hors ligne : journal du jour consultable, aliment noté puis envoyé au retour du réseau", async ({
  page,
  context,
}) => {
  // Les actions précédentes ont revalidé les pages : le service worker, lui, doit rester servi.
  expect((await page.request.get("/serwist/sw.js")).status()).toBe(200);
  await signIn(page, ADMIN);
  // Dès l'ouverture de l'app, l'accueil, le journal du jour et l'ajout sont gardés en cache.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return false;
          const cache = await caches.open("app-pages");
          return Boolean((await cache.match("/journal")) && (await cache.match("/add")));
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  await expect(async () => {
    await page.goto("/journal").catch(() => undefined);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journal", { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByText(/^Pas de réseau/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText("Granola maison")).toBeVisible();

  await page.goto("/add");
  await page.getByRole("tab", { name: "Favoris" }).click();
  await page.getByRole("button", { name: /^Granola maison/ }).click();
  await page.locator('select[name="slot"]').selectOption("dinner");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByText(/^Granola maison est noté sur ce téléphone/)).toBeVisible();
  const waiting = page.getByRole("region", { name: "1 aliment en attente d'envoi" });
  await expect(waiting.getByText("Granola maison", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);

  await context.setOffline(false);
  await expect(page.getByText("1 aliment noté hors ligne a été ajouté au journal.")).toBeVisible();
  await expect(waiting).toBeHidden();
  await page.goto("/journal");
  await expect(page.getByRole("region", { name: "Dîner" }).getByText("Granola maison")).toHaveCount(1);
});

test("ajout d'un produit par code-barres (Open Food Facts simulé)", async ({ page, context }) => {
  await context.grantPermissions(["camera"]);
  await signIn(page, ADMIN);
  await page.goto("/add?slot=snack");
  await page.getByRole("link", { name: "Code-barres" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scanner un code-barres");
  await expectNoA11yViolations(page);

  // Code inconnu : on propose de créer l'aliment ou de le chercher par son nom.
  await page.getByLabel("Saisir le code-barres").fill("4006381333931");
  await page.getByRole("button", { name: "Chercher ce produit" }).click();
  await expect(page.getByText("Ce produit n'est pas encore dans Open Food Facts.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer cet aliment" })).toBeVisible();

  await page.getByLabel("Saisir le code-barres").fill("3017620422003");
  await page.getByRole("button", { name: "Chercher ce produit" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pâte à tartiner noisettes");
  await expect(page.locator('img[src$="/images/front.png"]')).toBeVisible();
  await expect(page.getByText("Code-barres 3017620422003")).toBeVisible();
  // La photo du produit s'ouvre en grand ; Échap la referme.
  await page.getByRole("button", { name: "Voir en grand : Pâte à tartiner noisettes" }).click();
  const viewer = page.getByRole("dialog", { name: "Pâte à tartiner noisettes" });
  await expect(viewer.getByRole("img", { name: "Pâte à tartiner noisettes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Par portion (15 g)" })).toBeVisible();
  const labels = page.getByRole("list", { name: "Indicateurs de qualité" });
  await expect(labels.getByText("Nutri-Score E")).toBeVisible();
  await expect(labels.getByText("NOVA 4")).toBeVisible();
  await expectNoA11yViolations(page);
  // Un toucher sur un badge explique ce qu'il mesure et ce qui compte pour ce produit.
  await labels.getByRole("button", { name: "NOVA 4" }).click();
  const novaSheet = page.getByRole("dialog", { name: "NOVA 4, ultra-transformé" });
  await expect(novaSheet.getByText("Arôme", { exact: true })).toBeVisible();
  await expect(novaSheet.getByText("E322", { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(novaSheet).toBeHidden();
  await labels.getByRole("button", { name: "Nutri-Score E" }).click();
  await expect(page.getByRole("dialog", { name: "Nutri-Score E" }).getByText("56 g · élevé")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Ajouter au journal" }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("portion");
  await expect(page.getByText("Ça fait 81 kcal")).toBeVisible();
  await expect(page.locator('img[src$="/images/front.png"]')).toBeVisible();

  // Sans tranche ni pièce connue, on peut en donner le poids une fois pour toute la famille.
  await page.getByRole("button", { name: "Compter en tranches ou en pièces" }).click();
  await page.getByLabel("Compter en").selectOption("slice");
  await page.getByLabel("Poids en g").fill("20");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Enregistrer ce poids" }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("slice");
  await expect(page.getByText("Ça fait 108 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Collations" }).getByText(/^Pâte à tartiner noisettes/)).toBeVisible();
});

test("l'admin teste l'IA (LLM simulé), suit les coûts et peut la mettre en pause", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Gérer l'IA" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Intelligence artificielle");
  await expect(page.getByText("IA active")).toBeVisible();

  await page.getByRole("button", { name: "Tester la connexion" }).click();
  await expect(page.getByText(/^Texte : mock-text a répondu/)).toBeVisible();
  await expect(page.getByText(/^Photo : mock-vision a répondu/)).toBeVisible();
  const costs = page.getByRole("region", { name: "Coûts par mois et par membre" });
  await expect(costs.getByRole("rowheader", { name: "Adel" })).toBeVisible();

  await expectNoA11yViolations(page);

  const budget = page.getByRole("region", { name: "Plafond mensuel" });
  await page.getByLabel("Fonctions IA activées").uncheck();
  await budget.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/^IA désactivée par l'admin/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tester la connexion" })).toBeDisabled();
  await page.getByLabel("Fonctions IA activées").check();
  await budget.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("IA active")).toBeVisible();

  const photos = page.getByRole("region", { name: "Photos des repas" });
  await photos.getByLabel("Conservation (jours)").fill("60");
  await photos.getByRole("button", { name: "Enregistrer" }).click();
  await expect(photos.getByText("Durée de conservation enregistrée.")).toBeVisible();
});

/** Petite image PNG (2 × 2 px) : le navigateur la réduit et l'encode comme une vraie photo. */
const MEAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGM4UWEDRAwQCgArzgXx0HrtWgAAAABJRU5ErkJggg==",
  "base64",
);

test("le + ouvre l'éventail et la photo prise part vers l'écran d'ajout", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/journal");
  const plus = page.getByRole("button", { name: "Ajouter un repas" });
  const close = page.getByRole("button", { name: "Fermer les façons d'ajouter" });
  // Le bouton peut être touché avant l'hydratation de la page : on recommence au besoin, sans
  // retoucher un éventail déjà ouvert (le + s'appelle alors « Fermer »).
  await expect(async () => {
    if (!(await close.isVisible())) await plus.click({ timeout: 2000 });
    await expect(close).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Code-barres" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByLabel("Prendre mon repas en photo")
    .setInputFiles({ name: "repas.png", mimeType: "image/png", buffer: MEAL_PNG });
  await expect(page).toHaveURL(/\/add$/);
  await expect(page.getByRole("img", { name: "Photo de ton repas" })).toBeVisible();
});

test("saisie d'un repas par photo (LLM simulé), avec contenant et écran de confirmation", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/containers");
  await page.getByLabel("Nom").fill("Grand bol");
  await page.getByLabel("Volume (ml)").fill("500");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Bol · 500 ml")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/add?slot=lunch");
  // Le fichier peut être choisi avant l'hydratation de la page : on le redonne au besoin.
  await expect(async () => {
    await page
      .getByLabel("Choisir une photo")
      .setInputFiles({ name: "repas.png", mimeType: "image/png", buffer: MEAL_PNG });
    await expect(page.getByRole("img", { name: "Photo de ton repas" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Une précision ? (facultatif)").fill("sauce à part");
  await page.getByLabel("Dans quel contenant ?").selectOption({ label: "Grand bol" });
  await page.getByRole("button", { name: "Analyser la photo" }).click();

  await expect(page.getByRole("heading", { name: "On vérifie ensemble ?" })).toBeVisible();
  // Les aliments d'un même plat sont regroupés sous son nom.
  const dish = page.getByRole("region", { name: "Riz au poulet" });
  await expect(dish.getByText(/^Riz basmati, cuit/)).toBeVisible();
  await expect(dish.getByText("Reconnu : riz basmati cuit")).toBeVisible();
  // Une quantité démesurée est signalée : l'ajout attend une relecture.
  await page.getByLabel(/^Quantité de Riz basmati, cuit/).fill("900");
  await expect(page.getByText("1 aliment à vérifier", { exact: false })).toBeVisible();
  await expect(page.getByText("Grosse quantité pour un seul aliment : vérifie le poids.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter au journal" })).toBeDisabled();
  await page.getByRole("button", { name: /^C'est bon pour Riz basmati/ }).click();
  await expect(page.getByText("Vérifié", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter au journal" })).toBeEnabled();
  await page.getByLabel(/^Quantité de Riz basmati, cuit/).fill("150");
  await expect(page.getByText("1 aliment à vérifier", { exact: false })).toHaveCount(0);
  await expect(page.getByText(/^Total : \d+ kcal$/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Ajouter au journal" }).click();

  await expect(page).toHaveURL(/\/journal\?date=/);
  const lunch = page.getByRole("region", { name: "Déjeuner" });
  await expect(lunch.getByText(/^Riz basmati, cuit/)).toBeVisible();
  await expect(lunch.getByText("Riz au poulet", { exact: true })).toBeVisible();
  await expect(lunch.getByText(/^150 g/).first()).toBeVisible();
  // La photo du repas s'ouvre en grand, puis se referme.
  await lunch.getByRole("button", { name: "Voir en grand : Photo du déjeuner" }).click();
  const viewer = page.getByRole("dialog", { name: /^Déjeuner · / });
  await expect(viewer.getByRole("img", { name: "Photo du déjeuner" })).toBeVisible();
  await expectNoA11yViolations(page);
  await viewer.getByRole("button", { name: "Fermer" }).click();
  await expect(viewer).toHaveCount(0);
  // Macros d'un aliment en dépliant sa ligne, et répartition par repas.
  await lunch.getByRole("button", { name: /^Modifier Riz basmati, cuit/ }).click();
  await expect(lunch.getByText(/^Prot\. \d+ g$/).first()).toBeVisible();
  await page.getByText("Voir le détail").click();
  await expect(
    page
      .getByRole("table", { name: /Calories et macronutriments/ })
      .getByRole("rowheader", { name: "Déjeuner", exact: true }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});

test("saisie en texte libre, puis par le dictionnaire personnel sans appel à l'IA", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/add?slot=dinner");
  await page.getByRole("button", { name: "Écrire mon repas" }).click();
  await page.getByLabel("Décris ton repas").fill("riz et poulet");
  await page.getByRole("button", { name: "Analyser", exact: true }).click();
  await expect(page.getByRole("heading", { name: "On vérifie ensemble ?" })).toBeVisible();
  // Remplacer l'aliment nommé dans le plat renomme le plat.
  const chicken = page.getByRole("region", { name: "Riz au poulet" }).getByRole("listitem").nth(1);
  await chicken.getByRole("button", { name: "Changer d'aliment" }).click();
  await page.getByLabel("Remplacer « poulet rôti » par").fill("veau rôti");
  await page
    .getByRole("button", { name: /^Veau, rôti/ })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Riz au veau" }).getByText(/^Veau, rôti/)).toBeVisible();
  await page.getByRole("button", { name: /^Retirer Veau/ }).click();
  await expect(page.getByRole("button", { name: /^Retirer / })).toHaveCount(1);
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  const dinner = page.getByRole("region", { name: "Dîner" });
  await expect(dinner.getByText(/^Riz basmati, cuit/)).toBeVisible();
  // Le nom du plat se change à la main.
  await dinner.getByRole("button", { name: "Renommer le plat Riz au veau" }).click();
  await dinner.getByLabel("Nom du plat").fill("Riz du soir");
  await dinner.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dinner.getByText("Riz du soir", { exact: true })).toBeVisible();

  await page.goto("/dictionary");
  await page.getByRole("textbox", { name: "Expression" }).fill("ma tartine");
  await page.getByLabel("Aliment correspondant").fill("pain de mie courant");
  await page
    .getByRole("button", { name: /^Pain de mie, courant/ })
    .first()
    .click();
  await page.getByLabel("Unité").selectOption("g");
  await page.getByLabel("Quantité").fill("30");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("« ma tartine »")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/add?slot=breakfast");
  await page.getByRole("button", { name: "Écrire mon repas" }).click();
  await page.getByLabel("Décris ton repas").fill("2 ma tartine");
  await page.getByRole("button", { name: "Analyser", exact: true }).click();
  await expect(page.getByText("Reconnu grâce à ton dictionnaire et à tes habitudes, sans appel à l'IA.")).toBeVisible();
  await expect(page.getByLabel(/^Quantité de Pain de mie, courant/)).toHaveValue("60");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText(/^Pain de mie, courant/)).toBeVisible();
});

test("dictée : arrêter puis relancer, même quand le navigateur ne signale pas la fin", async ({ page }) => {
  // Reconnaissance vocale simulée comme Safari sur iPhone : après « stop », pas d'événement de fin,
  // et une nouvelle dictée échoue tant que la précédente n'est pas terminée.
  await page.addInitScript(() => {
    let count = 0;
    // Numéro de la dictée en cours (0 : aucune).
    let active = 0;
    class FakeRecognition {
      id = 0;
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        if (active !== 0 && active !== this.id) throw new DOMException("already started", "InvalidStateError");
        count += 1;
        this.id = count;
        active = this.id;
        const words = count === 1 ? "deux œufs" : "et du pain";
        setTimeout(() => this.onresult?.({ results: [Object.assign([{ transcript: words }], { isFinal: true })] }), 50);
      }
      stop() {}
      abort() {
        if (active === this.id) active = 0;
        setTimeout(() => this.onend?.(), 10);
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await signIn(page, ADMIN);
  await page.goto("/add?slot=dinner");
  await page.getByRole("button", { name: "Écrire mon repas" }).click();
  // Pendant la dictée, la phrase s'écrit en grand ; à l'arrêt, elle reste en grand avec Analyser,
  // et le micro permet de compléter. Le champ ne revient que pour corriger.
  const listening = page.getByRole("group", { name: "Dictée en cours" });
  const dictation = page.getByRole("group", { name: "Dictée", exact: true });
  await page.getByRole("button", { name: "Dicter" }).click();
  await expect(listening).toContainText("deux œufs");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Arrêter la dictée" }).click();
  await expect(dictation).toContainText("deux œufs");
  await expect(page.getByLabel("Décris ton repas")).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Compléter la dictée" }).click();
  await expect(listening).toContainText("deux œufs et du pain");
  await page.getByRole("button", { name: "Arrêter la dictée" }).click();
  await expect(dictation).toContainText("deux œufs et du pain");
  await page.getByRole("button", { name: "Corriger le texte" }).click();
  await expect(page.getByLabel("Décris ton repas")).toHaveValue("deux œufs et du pain");
});

test("dictée : le micro qui décroche laisse réessayer d'un toucher, sans retomber sur le champ", async ({ page }) => {
  // Première dictée : Safari renvoie « audio-capture » (micro pas encore libéré) ; la suivante marche.
  await page.addInitScript(() => {
    let count = 0;
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        count += 1;
        if (count === 1) {
          setTimeout(() => {
            this.onerror?.({ error: "audio-capture" });
            this.onend?.();
          }, 50);
          return;
        }
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: "un sandwich au fromage" }], { isFinal: true })] });
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {
        setTimeout(() => this.onend?.(), 10);
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await signIn(page, ADMIN);
  await page.goto("/add?slot=lunch");
  await page.getByRole("button", { name: "Voix" }).click();
  const dictation = page.getByRole("group", { name: "Dictée", exact: true });
  await expect(dictation).toContainText("Dictée interrompue");
  await expect(dictation.getByRole("alert")).toContainText("Le micro est indisponible");
  await expect(page.getByLabel("Décris ton repas")).toHaveCount(0);
  await page.getByRole("button", { name: "Réessayer la dictée" }).click();
  await expect(dictation).toContainText("un sandwich au fromage");
  await expect(dictation).toContainText("C'est noté");
  await expect(dictation.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyser", exact: true })).toBeEnabled();
});

test("coach : dicter un message puis l'envoyer avec Entrée", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: "que manger ce soir" }], { isFinal: true })] });
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await signIn(page, ADMIN);
  await page.goto("/coach");
  const field = page.getByLabel("Ton message");
  await field.fill("Bonjour,");
  await page.getByRole("button", { name: "Dicter" }).click();
  await expect(field).toHaveValue("Bonjour, que manger ce soir");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  const conversation = page.getByRole("list", { name: "Conversation avec le coach" });
  await expect(conversation.getByText(/Tu me demandais : « Bonjour, que manger ce soir »/)).toBeVisible();
  await page.getByRole("button", { name: "Effacer la conversation" }).click();
  await expect(page.getByText(/Aucun message pour l'instant/)).toBeVisible();
});

test("activation de la double authentification puis connexion avec un code", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/profile/security");
  const security = page.getByRole("main");
  await security.getByLabel("Mot de passe").fill(ADMIN.password);
  await security.getByRole("button", { name: "Activer la double authentification" }).click();
  await expect(security.getByRole("img", { name: "QR code" })).toBeVisible();
  totpSecret = (await security.locator("code").textContent())!.trim();
  await security.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await security.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("La double authentification est activée.")).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/\/login\/two-factor$/);
  await page.getByLabel("Code à 6 chiffres").fill("000000");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(alertIn(page)).toHaveText("Code incorrect.");
  await page.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel");
});

async function signInWithTotp(page: Page) {
  await signIn(page, ADMIN);
  await page.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel");
}

test("l'admin invite un membre mineur qui n'a pas accès à la perte de poids", async ({ page, browser }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Moi", exact: true }).click();
  await page.getByRole("link", { name: "Administration" }).click();
  await page.getByLabel("Pour qui ? (ex. : Maman, Léo)").fill("Léa");
  await page.getByRole("button", { name: "Créer le lien" }).click();
  inviteUrl = (await page.locator("code").first().textContent())!.trim();
  expect(inviteUrl).toMatch(/\/invite\/[\w-]{40,}$/);
  await expect(page.getByText("Invitations en attente")).toBeVisible();
  await expectNoA11yViolations(page);

  const teen = await newPage(browser);
  await teen.goto(inviteUrl);
  await expect(teen.getByRole("heading", { level: 1 })).toHaveText("Rejoindre le foyer Famille Z.");
  await expect(teen.getByLabel("Prénom ou surnom")).toHaveValue("Léa");
  await teen.getByLabel("Adresse e-mail").fill(TEEN.email);
  await teen.getByLabel("Mot de passe").fill(TEEN.password);
  await teen.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(teen).toHaveURL(/\/onboarding$/);

  const next = teen.getByRole("button", { name: "Continuer" });
  await teen.getByLabel("Femme").check();
  const fifteenYearsAgo = new Date();
  fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
  await teen.getByLabel("Date de naissance").fill(fifteenYearsAgo.toISOString().slice(0, 10));
  await next.click();
  await teen.getByLabel("Taille en cm").fill("160");
  await teen.getByLabel("Poids en kg").fill("50");
  await next.click();
  await expect(teen.getByText(/Avant 18 ans, on se concentre sur l'équilibre/)).toBeVisible();
  await expect(teen.getByRole("radio")).toHaveCount(2);
  await expect(teen.getByLabel("Perdre du poids")).toHaveCount(0);
  await expect(teen.getByLabel("Prendre du muscle")).toHaveCount(0);

  // Le lien d'invitation ne sert qu'une fois.
  const intruder = await newPage(browser);
  await intruder.goto(inviteUrl);
  await expect(intruder.getByRole("heading", { level: 1 })).toHaveText("Lien expiré");
});

test("l'admin génère un lien de nouveau mot de passe pour un membre", async ({ page, browser }) => {
  await signInWithTotp(page);
  await page.goto("/admin");
  const lea = page.getByRole("listitem").filter({ hasText: TEEN.email });
  await lea.getByRole("button", { name: "Lien de nouveau mot de passe" }).click();
  const resetUrl = (await lea.locator("code").textContent())!.trim();

  const teen = await newPage(browser);
  await teen.goto(resetUrl);
  await teen.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe-lea");
  await teen.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(teen.getByText(/C'est fait !/)).toBeVisible();
  await signIn(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await expect(teen).toHaveURL(/\/onboarding$/);
});

test("repas partagé : l'admin partage un plat du foyer, le membre le valide avec sa portion", async ({
  page,
  browser,
}) => {
  test.slow(); // deux sessions (admin puis membre) dans le même test
  await signInWithTotp(page);
  await page.goto("/family/share?slot=dinner");
  await page.getByRole("button", { name: "Nouveau plat (ingrédients ou photo)" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Gratin du dimanche");
  await page.getByLabel("Nombre de portions").fill("4");
  await page.getByLabel("Ajouter un ingrédient").fill("pâtes cuites");
  await page
    .getByRole("button", { name: /^Pâtes/ })
    .first()
    .click();
  await page.getByRole("textbox", { name: /Quantité de Pâtes/ }).fill("600");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByRole("heading", { name: "Gratin du dimanche" })).toBeVisible();
  await expect(page.getByLabel("Poids du plat entier (g)")).toHaveValue("600");
  await expect(page.getByText(/^1 part ≈ 150 g, \d+ kcal$/)).toBeVisible();
  await expect(page.getByLabel("Léa")).toBeChecked();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Partager" }).click();
  await expect(page).toHaveURL(/\/journal\?date=/);
  await expect(page.getByRole("region", { name: "Dîner" }).getByText("Gratin du dimanche")).toBeVisible();

  const teen = await newPage(browser);
  await signIn(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await teen.goto("/plan");
  const pending = teen.getByRole("region", { name: "Repas partagés à valider" });
  await expect(pending.getByRole("heading", { name: "Gratin du dimanche" })).toBeVisible();
  await expect(pending.getByText(/^Adel a partagé ce plat pour le dîner/)).toBeVisible();
  await expectNoA11yViolations(teen);
  await pending.getByText("½ part", { exact: true }).click();
  await expect(pending.getByText(/^Ça fait 75 g, \d+ kcal$/)).toBeVisible();
  await pending.getByRole("button", { name: "Ajouter à mon journal" }).click();
  await expect(teen.getByRole("region", { name: "Repas partagés à valider" })).toHaveCount(0);
  await teen.goto("/journal");
  await expect(teen.getByRole("region", { name: "Dîner" }).getByText(/^75 g/)).toBeVisible();

  // Léa met sa photo du gratin : la fiche l'affiche, légendée comme photo de la famille.
  await teen.goto("/recipes");
  await expect(teen.getByRole("link", { name: /^Gratin du dimanche/ })).toBeVisible();
  await teen.getByRole("link", { name: /^Gratin du dimanche/ }).click();
  await expect(teen.getByRole("heading", { level: 1 })).toHaveText("Gratin du dimanche");
  await withServerAction(teen, () =>
    teen.getByLabel("Ajouter une photo").setInputFiles({ name: "gratin.png", mimeType: "image/png", buffer: MEAL_PNG }),
  );
  await expect(teen.getByText("Photo de la famille, visible seulement par le foyer.")).toBeVisible();
  await expect(teen.locator("figure img").first()).toHaveAttribute("src", /\/api\/foods\/.+\/photo\?v=/);
  await expect(teen.getByLabel("Changer la photo")).toBeAttached();
  await expectNoA11yViolations(teen);

  // Un repas de « Mes repas » se partage aussi : Léa le valide avec sa portion.
  await page.goto("/meals");
  await page.getByRole("link", { name: "Partager Grand petit-déj" }).click();
  await expect(page.getByRole("heading", { name: "Partager « Grand petit-déj »" })).toBeVisible();
  await expect(page.getByLabel("Léa")).toBeChecked();
  await expectNoA11yViolations(page);
  await withServerAction(page, () => page.getByRole("button", { name: "Partager" }).click());
  await expect(page).toHaveURL(/\/meals$/);

  await teen.goto("/plan");
  const meal = teen.getByRole("region", { name: "Repas partagés à valider" });
  await expect(meal.getByRole("heading", { name: "Grand petit-déj" })).toBeVisible();
  await expect(meal.getByText(/^Adel a partagé ce repas pour le/)).toBeVisible();
  await expect(meal.getByText(/^Portion de Adel : \d+ g, \d+ kcal$/)).toBeVisible();
  await expectNoA11yViolations(teen);
  await meal.getByText("2 portions", { exact: true }).click();
  await meal.getByRole("button", { name: "Ajouter à mon journal" }).click();
  await expect(teen.getByRole("region", { name: "Repas partagés à valider" })).toHaveCount(0);
  await teen.goto("/journal");
  await expect(teen.getByText("Grand petit-déj", { exact: true })).toBeVisible();
});

test("bilan qualité de la semaine", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Progrès" }).click();
  await expectNoA11yViolations(page);
  await page.getByRole("link", { name: /^Bilan qualité/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bilan qualité");
  await expect(page.getByRole("heading", { name: "Idées pour la semaine" })).toBeVisible();
  // La pâte à tartiner scannée plus tôt est un produit ultra-transformé (NOVA 4).
  await expect(page.getByText(/Ultra-transformés les plus présents : .*Pâte à tartiner noisettes/)).toBeVisible();
  await expectNoA11yViolations(page);
});

test("coach : bilan, conversation (LLM simulé), garde-fou", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Moi", exact: true }).click();
  await page.getByRole("link", { name: "Coach", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pépin");
  // Le foyer de test vient d'être créé : pas assez de jours la semaine dernière pour un bilan.
  await expect(page.getByText(/Pas encore de bilan/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel("Ton message").fill("Que manger ce soir ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const conversation = page.getByRole("list", { name: "Conversation avec le coach" });
  await expect(conversation.getByText(/Tu me demandais : « Que manger ce soir \? »/)).toBeVisible();
  await expect(page.getByLabel("Ton message")).toHaveValue("");

  await page.getByLabel("Ton message").fill("Un menu à 900 kcal par jour ?");
  await page.keyboard.press("Enter");
  await expect(conversation.getByText(/en dessous de ton minimum journalier/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.reload();
  await expect(conversation.getByText(/Tu me demandais/)).toBeVisible();

  await page.getByRole("button", { name: "Effacer la conversation" }).click();
  await expect(page.getByText(/Aucun message pour l'instant/)).toBeVisible();

  // Depuis l'accueil, une question toute prête est posée à Pépin dès l'ouverture du coach.
  await page.goto("/");
  const card = page.getByRole("region", { name: /Demande à Pépin/ });
  const question = card.getByRole("link", { name: /\?$/ }).first();
  const asked = (await question.textContent()) ?? "";
  await question.click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(conversation.getByText(`Tu me demandais : « ${asked} »`, { exact: false })).toBeVisible();
  await page.reload();
  // Le rechargement ne repose pas la question.
  await expect(conversation.getByText(/Tu me demandais/)).toHaveCount(1);
  await page.getByRole("button", { name: "Effacer la conversation" }).click();

  // Depuis un repas du journal, Pépin s'ouvre par-dessus la page avec le repas joint.
  await page.goto("/journal");
  await page.getByRole("button", { name: "Plus d'actions pour le déjeuner" }).click();
  await page.getByRole("dialog", { name: "Déjeuner" }).getByRole("button", { name: "Demander à Pépin" }).click();
  const panel = page.getByRole("dialog", { name: "Pépin" });
  await expect(panel.getByText(/^À propos de : Déjeuner · \d+ kcal$/)).toBeVisible();
  await expectNoA11yViolations(page);
  await panel.getByRole("button", { name: "Ce repas est-il équilibré ?" }).click();
  await expect(panel.getByText("Tu me demandais : « Ce repas est-il équilibré ? »", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journal");
  // L'échange rejoint la conversation du coach.
  await page.goto("/coach");
  await expect(conversation.getByText(/Ce repas est-il équilibré/).first()).toBeVisible();
  await page.getByRole("button", { name: "Effacer la conversation" }).click();
});

test("menu de la semaine, liste de courses commune, recettes et scanner de frigo (LLM simulé)", async ({ page }) => {
  test.slow(); // parcours sur quatre écrans
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Cuisine", exact: true }).click();
  await page.getByRole("navigation", { name: "Cuisine" }).getByRole("link", { name: "Menu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Menu de la semaine");
  const add = page.getByRole("region", { name: "Ajouter un plat" });
  await add.getByLabel("Repas").selectOption("dinner");
  await add.getByLabel(/^Recette/).selectOption({ label: "Gratin du dimanche" });
  await add.getByLabel("Nombre de parts").fill("4");
  await add.getByRole("button", { name: "Ajouter au menu" }).click();
  await expect(page.getByRole("link", { name: "Servir Gratin du dimanche et le partager" })).toBeVisible();
  await add.getByLabel("Nom du plat").fill("Restes");
  await add.getByRole("button", { name: "Ajouter au menu" }).click();
  await page.getByRole("button", { name: "Retirer Restes" }).click();
  await expect(page.getByRole("button", { name: "Retirer Restes" })).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Semaine suivante : le coach (simulé) remplit le déjeuner et le dîner encore vides.
  await page.getByRole("link", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/\?week=/);
  await page.getByRole("button", { name: "Proposer un menu" }).click();
  await expect(page.getByText("2 repas ajoutés au menu.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^lundi/ }).getByText("Poêlée de lentilles aux carottes"),
  ).toBeVisible();

  await page.goto("/shopping");
  await page.getByRole("button", { name: "Remplir avec le menu de la semaine" }).click();
  await expect(page.getByText(/articles? tirés? du menu/)).toBeVisible();
  // 600 g de pâtes pour 4 parts, 4 parts au menu.
  const grocery = page.getByRole("region", { name: "Épicerie" });
  await expect(grocery.getByText(/^Pâtes.* · 600 g$/)).toBeVisible();
  await page.getByRole("textbox", { name: "Article" }).fill("Papier cuisson");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("region", { name: "Autres" }).getByText("Papier cuisson")).toBeVisible();
  await withServerAction(page, () => grocery.getByRole("checkbox", { name: /^Pâtes/ }).click());
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Dans le panier" }).getByRole("checkbox", { name: /^Pâtes/ }),
  ).toBeChecked();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Retirer les articles cochés" }).click();
  await expect(page.getByRole("region", { name: "Dans le panier" })).toHaveCount(0);

  await page.goto("/recipes");
  // Une seule bibliothèque : les recettes de la famille en tête, avec les idées, sans filtre à part.
  await expect(
    page.getByRole("group", { name: "Type de recette" }).getByRole("button", { name: "Nos recettes" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Gratin du dimanche/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Poêlée de lentilles aux carottes/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Minestrone/ })).toBeVisible();
  // Recherche sur place, par nom ou ingrédient.
  await page.getByRole("searchbox", { name: "Rechercher une recette ou un ingrédient" }).fill("gratin");
  await expect(page.getByRole("link", { name: /^Gratin du dimanche/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Minestrone/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Rechercher une recette ou un ingrédient" }).fill("zzz");
  await expect(page.getByText("Aucune recette ne correspond. Essaie un autre mot.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Rechercher une recette ou un ingrédient" }).fill("");
  await expectNoA11yViolations(page);

  // Fiche d'une recette du foyer : ses ingrédients, et sa préparation rédigée à la demande.
  await page.getByRole("link", { name: /^Poêlée de lentilles aux carottes/ }).click();
  await expect(page.getByRole("heading", { name: "Ingrédients" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ingrédients" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText(/Pas encore de préparation/)).toBeVisible();
  await page.getByRole("button", { name: "Demander la préparation à Pépin" }).click();
  await expect(page.getByText("Prépare et coupe les ingrédients.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Préparation" }).getByRole("listitem")).toHaveCount(3);
  await expectNoA11yViolations(page);

  await page.goto("/fridge");
  const omelette = page.getByRole("listitem", { name: "Omelette à la tomate" });
  // Un fichier choisi avant l'hydratation de la page n'est pas vu : on le redonne si besoin.
  await expect(async () => {
    await page
      .getByLabel("Choisir une photo")
      .setInputFiles({ name: "frigo.png", mimeType: "image/png", buffer: MEAL_PNG });
    await expect(omelette.getByText(/^\d+ kcal la portion · /)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText(/^Repéré : œuf, tomate/)).toBeVisible();
  await expectNoA11yViolations(page);
  await omelette.getByRole("button", { name: "Enregistrer et ajouter au journal" }).click();
  await expect(page).toHaveURL(/\/add\?food=/);
  await expect(page.getByText("Omelette à la tomate").first()).toBeVisible();
});

test("espace Training : profil sportif, séance express guidée, suivi et bibliothèque", async ({ page }) => {
  test.slow(); // parcours complet d'une séance
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Progrès" }).click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon profil sportif");
  // Tous les jours, pour avoir une séance aujourd'hui quel que soit le jour du test.
  for (const day of ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]) {
    await page.getByRole("checkbox", { name: day }).check({ force: true });
  }
  await page.getByRole("checkbox", { name: "Genoux" }).check({ force: true });
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Enregistrer mon profil" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entraînement");
  const today = page.getByRole("region", { name: "Séance du jour" });
  await expect(today.getByRole("link", { name: "Démarrer la séance" })).toBeVisible();
  await expectNoA11yViolations(page);
  await today.getByRole("link", { name: "Remplacer" }).click();
  await expect(page.getByRole("heading", { name: "Séance de remplacement" })).toBeVisible();
  await page.getByRole("link", { name: "Revenir à la séance prévue" }).click();
  await expect(page.getByRole("heading", { name: "Séance du jour" })).toBeVisible();

  await page.getByRole("link", { name: "Séance express (10 min)" }).click();
  await expect(page.getByRole("heading", { name: "Au programme" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "C'est parti" }).click();
  const stepLabel = (n: number) => page.getByText(new RegExp(`^Étape ${n} sur 7`));
  const setDone = page.getByRole("button", { name: "Série faite" });
  await expect(stepLabel(1)).toBeVisible();
  await expectNoA11yViolations(page);
  await setDone.click();
  await expect(stepLabel(2)).toBeVisible();
  await setDone.click();
  await expect(stepLabel(3)).toBeVisible();
  await page.getByRole("button", { name: "Douleur ou zone à ménager" }).click();
  await expect(page.getByText(/Exercice mis de côté/)).toBeVisible();
  for (const step of [4, 5]) {
    await expect(stepLabel(step)).toBeVisible();
    await setDone.click();
    await page.getByRole("button", { name: "Passer le repos" }).click();
    await setDone.click();
  }
  await expect(stepLabel(6)).toBeVisible();
  await setDone.click();
  await expect(stepLabel(7)).toBeVisible();
  await setDone.click();
  await expect(page.getByRole("heading", { name: "Séance terminée, bravo !" })).toBeVisible();
  await page.getByText("Bien", { exact: true }).click();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Enregistrer la séance" }).click();

  await expect(page).toHaveURL(/\/training\/history$/);
  await expect(page.getByText("1 semaine active d'affilée")).toBeVisible();
  await expect(page.getByRole("region", { name: "Séances" }).getByText("Séance express (10 min)")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Activité/ })).toContainText(/Activité[1-9]\d* kcal/);

  await page.goto("/training/library?muscle=core");
  await expect(page.getByRole("link", { name: /Planche sur les avant-bras/ })).toBeVisible();
  await expectNoA11yViolations(page);
  const excluded = page.getByRole("region", { name: "Exercices mis de côté" });
  await expect(excluded).toBeVisible();
  await excluded.getByRole("button", { name: /^Réintégrer / }).click();
  await expect(page.getByRole("region", { name: "Exercices mis de côté" })).toHaveCount(0);
  await page.getByRole("link", { name: /Planche sur les avant-bras/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planche sur les avant-bras");
  await expect(page.getByText(/^Plus doux : /)).toBeVisible();
});

test("corps et activité : mensuration, photos de progression, activité, pas et import CSV", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Progrès" }).click();
  await page.getByRole("navigation", { name: "Raccourcis" }).getByRole("link", { name: "Corps", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Corps");
  await expectNoA11yViolations(page);

  await page.getByLabel("Tour mesuré").selectOption("waist");
  await page.getByLabel("Valeur (cm)").fill("88,5");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const changes = page.getByRole("region", { name: "Évolution" });
  await expect(changes.getByText("88,5 cm", { exact: true }).first()).toBeVisible();
  await expect(changes.getByText("stable depuis le début")).toBeVisible();

  const gallery = page.getByRole("region", { name: "Dernières photos" });
  for (const count of [1, 2]) {
    await page
      .getByLabel("Photo", { exact: true })
      .setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: MEAL_PNG });
    await page.getByRole("button", { name: "Ajouter la photo" }).click();
    // Le formulaire se vide une fois la photo affichée : on attend avant la suivante.
    await expect(gallery.getByRole("img")).toHaveCount(count);
    await expect(page.getByRole("button", { name: "Ajouter la photo" })).toBeEnabled();
  }
  const compare = page.getByRole("region", { name: "Avant / maintenant" });
  await expect(compare.getByRole("img")).toHaveCount(2);
  await expectNoA11yViolations(page);
  await gallery
    .getByRole("button", { name: /^Supprimer la photo / })
    .first()
    .click();
  await expect(gallery.getByRole("img")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Avant / maintenant" })).toHaveCount(0);

  await page.goto("/weight");
  await page.getByRole("link", { name: "Activité et pas" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Activité");
  await page.getByLabel("Activité", { exact: true }).selectOption("walking");
  await page.getByLabel("Durée (min)").fill("30");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const recent = page.getByRole("region", { name: "Activités des 14 derniers jours" });
  await expect(recent.getByText(/30 min, modérée, \d+ kcal/)).toBeVisible();

  await page.getByLabel("Nombre de pas").fill("12000");
  await withServerAction(page, () => page.getByRole("button", { name: "Enregistrer les pas" }).click());
  await expect(page.getByRole("region", { name: "Pas", exact: true }).getByText(/^12\s000 pas$/)).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  const csv = `Date,Activity type,Duration (s)\n${today},Cycling,1200\n`;
  await page
    .getByLabel("Fichier CSV")
    .setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importer" }).click();
  await expect(page.getByText("Import terminé : aucun jour de pas, 1 activité, aucune ligne ignorée.")).toBeVisible();
  await expect(recent.getByText("Vélo")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Activité/ })).toContainText(/Activité[1-9]\d* kcal/);
});

test("jeûne : planning, minuteur et historique ; traitement : rappel et journal des prises", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Moi", exact: true }).click();
  await page.getByRole("navigation", { name: "Raccourcis" }).getByRole("link", { name: "Jeûne", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jeûne");
  await expect(page.getByText(/Pommelia ne donne pas d'avis médical/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel("Suivre un planning de jeûne").check();
  await page.getByLabel("Protocole du Dimanche").selectOption("");
  await page.getByLabel("Protocole du Samedi").selectOption("custom");
  await page.getByLabel("Durée du jeûne perso (heures)").fill("13");
  await page.getByLabel("Début du jeûne le Lundi").fill("19:30");
  await page.getByRole("button", { name: "Enregistrer le planning" }).click();
  await expect(page.getByText("Planning enregistré.")).toBeVisible();

  // Selon l'heure, le planning a pu démarrer un jeûne tout seul : on le termine d'abord.
  // On attend que la page affiche l'un ou l'autre bouton avant de décider.
  const endFast = page.getByRole("button", { name: "Terminer le jeûne" });
  const startFast = page.getByRole("button", { name: "Commencer un jeûne maintenant" });
  await expect(endFast.or(startFast)).toBeVisible();
  if (await endFast.isVisible()) await withServerAction(page, () => endFast.click());
  await startFast.click();
  await expect(page.getByRole("progressbar", { name: "Progression du jeûne" })).toBeVisible();
  await expect(page.getByText(/^Encore \d+ h \d+ min avant ta fenêtre de repas\.$/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/");
  await page.getByRole("link", { name: /^Jeûne en cours/ }).click();
  await page.getByRole("button", { name: "Terminer le jeûne" }).click();
  await expect(page.getByRole("button", { name: "Commencer un jeûne maintenant" })).toBeVisible();
  const history = page.getByRole("region", { name: "Historique" });
  await expect(history.getByRole("button", { name: /^Supprimer le jeûne du / }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Durée du jeûne perso (heures)")).toHaveValue("13");
  await expect(page.getByLabel("Début du jeûne le Lundi")).toHaveValue("19:30");

  await page.goto("/treatment");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Traitement");
  await expect(page.getByText(/ne calcule ni ne conseille aucune dose/)).toBeVisible();
  const list = page.getByRole("region", { name: "Mes traitements" });
  await list.getByLabel("Nom").fill("Injection hebdo");
  await list.getByText("Mercredi", { exact: true }).click();
  await list.getByLabel("Heure du rappel").fill("09:00");
  await list.getByRole("button", { name: "Ajouter" }).click();
  await expect(list.getByText("Rappel : Mercredi à 09:00")).toBeVisible();

  const log = page.getByRole("region", { name: "Noter une prise" });
  await expect(log.getByLabel("Traitement")).toHaveValue(/.+/);
  await log.getByLabel("Note").fill("cuisse gauche");
  await log.getByRole("button", { name: "Enregistrer la prise" }).click();
  const logs = page.getByRole("region", { name: "Dernières prises" });
  await expect(logs.getByText("Injection hebdo")).toBeVisible();
  await expect(logs.getByText(/cuisse gauche/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/profile/notifications");
  await expect(page.getByLabel("Jeûne")).toBeChecked();
  await expect(page.getByLabel("Traitement")).toBeChecked();
});

test("mon métabolisme : objectif figé ou ajusté", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Progrès" }).click();
  await page.getByRole("link", { name: "Mon métabolisme" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon métabolisme");
  await expect(page.getByText(/il faut au moins 14 jours de suivi/)).toBeVisible();
  await expect(page.getByText("Calculé avec la formule de départ.")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Figer mon objectif" }).click();
  await expect(page.getByText(/Ton objectif est figé/)).toBeVisible();
  await page.getByRole("button", { name: "Laisser l'objectif s'ajuster" }).click();
  await expect(page.getByRole("button", { name: "Figer mon objectif" })).toBeVisible();
});

test("recettes du catalogue : bibliothèque illustrée, fiche et ajout", async ({ page }) => {
  await signInWithTotp(page);
  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: /^Minestrone/ })).toBeVisible();
  // Le filtre agit sur place, sans recharger la page (ni la remonter) ; l'adresse retient la catégorie.
  await page.evaluate(() => Object.assign(window, { samePage: true }));
  await page.getByRole("group", { name: "Type de recette" }).getByRole("button", { name: "Soupes" }).click();
  await expect(page.getByRole("button", { name: "Soupes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/cat=soup/);
  expect(await page.evaluate(() => "samePage" in window)).toBe(true);
  await expect(page.getByRole("link", { name: /^Minestrone/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Taboulé aux herbes/ })).toHaveCount(0);
  await page.getByRole("link", { name: /^Minestrone/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Minestrone");
  await expect(page.getByText("Recette Pommelia")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingrédients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Préparation" })).toBeVisible();
  await expectNoA11yViolations(page);
  // Retour à la liste : le filtre choisi est toujours là.
  await page.getByRole("link", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/recipes\?cat=soup/);
  await expect(page.getByRole("button", { name: "Soupes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /^Taboulé aux herbes/ })).toHaveCount(0);
  await page.getByRole("link", { name: /^Minestrone/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Minestrone");
  await page.getByRole("link", { name: "Ajouter au journal" }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("portion");
  // La photo de la recette accompagne l'écran de quantité.
  await expect(
    page.locator('form[aria-labelledby="quantity-title"] img[src*="/recipes/minestrone-480"]'),
  ).toBeVisible();
});

test("audit d'accessibilité : chaque page de l'app, en thème clair et sombre", async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  // Sans animation : axe mesurerait sinon des contrastes en plein fondu d'arrivée de la page.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInWithTotp(page);
  const pages = [
    "/",
    "/journal",
    "/add",
    "/progress",
    "/quality",
    "/metabolism",
    "/coach",
    "/plan",
    "/shopping",
    "/recipes",
    "/fridge",
    "/foods",
    "/foods/new",
    "/foods/new-recipe",
    "/containers",
    "/meals",
    "/dictionary",
    "/family/share",
    "/training",
    "/training/history",
    "/training/library",
    "/body",
    "/activity",
    "/fasting",
    "/treatment",
    "/weight",
    "/profile",
    "/profile/preferences",
    "/profile/notifications",
    "/profile/security",
    "/profile/account",
    "/admin",
    "/admin/ai",
  ];
  const violations: string[] = [];
  for (const theme of ["light", "dark"]) {
    await context.addCookies([{ name: "theme", value: theme, url: baseURL! }]);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
      await expect(page).toHaveTitle(/\S/);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      for (const violation of results.violations) {
        for (const node of violation.nodes) violations.push(`${path} (${theme}) ${violation.id} : ${node.html}`);
      }
    }
  }
  // Toutes les pages d'abord, pour voir l'ensemble des écarts d'un coup.
  expect(violations).toEqual([]);

  // Au clavier, le premier arrêt mène directement au contenu.
  await page.goto("/journal");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("export des données en JSON et CSV", async ({ page }) => {
  await signInWithTotp(page);
  await page.goto("/profile/account");
  const [json] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Télécharger (JSON)" }).click(),
  ]);
  const content = JSON.parse(await (await json.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
  expect(content.account.email).toBe(ADMIN.email);
  expect(content.profile.foodsToAvoid).toBe("coriandre");
  expect(JSON.stringify(content)).not.toMatch(/argon2|backupCodes/);

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Télécharger (CSV)" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^pommelia-export-.*\.zip$/);
});

test("un membre supprime son compte ; le dernier admin ne peut pas", async ({ page, browser }) => {
  const teen = await newPage(browser);
  await signIn(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await teen.goto("/profile/account");
  const danger = teen.getByRole("region", { name: "Supprimer mon compte" });
  await danger.getByLabel("Mot de passe").fill("nouveau-mot-de-passe-lea");
  await danger.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(teen).toHaveURL(/\/login$/);
  await submitLogin(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await expect(alertIn(teen)).toHaveText("E-mail ou mot de passe incorrect.");

  await signInWithTotp(page);
  await page.goto("/profile/account");
  const own = page.getByRole("region", { name: "Supprimer mon compte" });
  await own.getByLabel("Mot de passe").fill(ADMIN.password);
  await own.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(own.getByRole("alert")).toHaveText("Le dernier administrateur du foyer ne peut pas être supprimé.");
});
