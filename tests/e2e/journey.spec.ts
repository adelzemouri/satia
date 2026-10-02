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
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
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

  await expect(page.getByLabel("Prénom")).toHaveValue("Adel");
  await next.click();
  await page.getByLabel("Homme").check();
  await next.click();
  await page.getByLabel("Date de naissance").fill("1988-04-12");
  await next.click();
  await page.getByLabel("Taille en cm").fill("178");
  await next.click();
  await page.getByLabel("Poids en kg").fill("25");
  await next.click();
  await expect(page.getByText("Indique un poids entre 30 et 300 kg.")).toBeVisible();
  await page.getByLabel("Poids en kg").fill("82,5");
  await next.click();
  await page.getByLabel("Perdre du poids").check();
  await next.click();
  await page.getByLabel("Poids cible en kg").fill("55");
  await next.click();
  await expect(page.getByText(/On préfère ne pas viser en dessous de 58,7 kg/)).toBeVisible();
  await page.getByLabel("Poids cible en kg").fill("77");
  await next.click();
  await page.getByLabel("Un peu actif").check();
  await next.click();
  await expect(page.getByText(/Environ 0,25 kg par semaine · Objectif estimé vers le/)).toBeVisible();
  await page.getByLabel("Doux").check();
  await next.click();
  await page.getByLabel("Sans porc").check();
  await page.getByLabel("Aliments que tu préfères éviter").fill("coriandre");
  await next.click();
  await next.click(); // horaires par défaut
  await expect(page.getByLabel("Budget quotidien")).toBeChecked();
  await next.click();
  await expect(page.getByLabel("Pédagogue")).toBeChecked();
  await page.getByLabel("Serein").check();
  await next.click();
  await next.click();
  await expect(alertIn(page)).toHaveText("Merci de confirmer avoir lu ce message.");
  await page.getByLabel("J'ai compris").check();
  await next.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ton plan de départ");
  await expect(page.getByText(/formule de Mifflin-St Jeor/)).toBeVisible();
  await expect(page.getByText(/s'affinera automatiquement après deux semaines/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "C'est parti !" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel !");
  await expect(page.getByText("Ton objectif du jour")).toBeVisible();
  await expect(page.getByText("Protéines")).toBeVisible();
  await expectNoA11yViolations(page);
});

test("le thème choisi dans le profil est appliqué et conservé", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.getByRole("link", { name: "Profil" }).click();
  await page.getByText("Sombre").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoA11yViolations(page);
});

test("réglages des notifications et génération des clés côté admin", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/profile");
  const card = page.getByRole("region", { name: "Notifications" });
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajouter un aliment");
  await page.getByLabel("Rechercher un aliment").fill("pomme crue");
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
  await expect(lunch.getByText(/200 g ·/)).toBeVisible();
  await expectNoA11yViolations(page);

  // Modifier la quantité met les valeurs à jour.
  await lunch.getByRole("button", { name: /^Modifier Pomme, pulpe et peau, crue/ }).click();
  await lunch.getByLabel("Quantité").fill("100");
  await lunch.getByRole("button", { name: "Enregistrer" }).click();
  await expect(lunch.getByText(/^100 g · 5\d kcal/)).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  await expect(page.getByText(/^\d+ kcal consommées$/)).not.toHaveText("0 kcal consommées");
  await expect(page.getByText(/1 jour d'affilée/)).toBeVisible();
  await expectNoA11yViolations(page);
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

  await page.getByRole("link", { name: "Ajouter", exact: true }).click();
  await page.getByRole("tab", { name: "Mes aliments" }).click();
  await page.getByRole("button", { name: "Ajouter Granola maison aux favoris" }).click();
  await page.getByRole("tab", { name: "Favoris" }).click();
  await page.getByRole("button", { name: /^Granola maison/ }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("portion");
  // Valeurs saisies pour une portion, énergie calculée depuis les macros : 5 × 4 + 30 × 4 + 8 × 9.
  await expect(page.getByText("Ça fait 212 kcal")).toBeVisible();
  await page.getByLabel("Repas").selectOption("breakfast");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText("Granola maison")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  await withServerAction(page, () => page.getByRole("button", { name: "Verre 3" }).click());
  await expect(page.getByText("3 / 8 verres")).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 / 8 verres")).toBeVisible();

  await page.getByRole("link", { name: "Poids" }).click();
  await page.getByLabel("Poids en kg").fill("82");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Tendance actuelle : 82 kg")).toBeVisible();
  await expect(page.getByText(/Encore quelques pesées/)).toBeVisible();
  await expectNoA11yViolations(page);
});

test("ajout d'un produit par code-barres (Open Food Facts simulé)", async ({ page, context }) => {
  await context.grantPermissions(["camera"]);
  await signIn(page, ADMIN);
  await page.goto("/add?slot=snack");
  await page.getByRole("link", { name: "Scanner un code-barres" }).click();
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
  await expect(page.getByRole("columnheader", { name: "Par portion (15 g)" })).toBeVisible();
  const labels = page.getByRole("list", { name: "Indicateurs de qualité" });
  await expect(labels.getByText("Nutri-Score E")).toBeVisible();
  await expect(labels.getByText("NOVA 4")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "Ajouter au journal" }).click();
  await expect(page.getByLabel("Unité")).toHaveValue("portion");
  await expect(page.getByText("Ça fait 81 kcal")).toBeVisible();
  await expect(page.locator('img[src$="/images/front.png"]')).toBeVisible();
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

test("saisie d'un repas par photo (LLM simulé), avec contenant et écran de confirmation", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/containers");
  await page.getByLabel("Nom").fill("Grand bol");
  await page.getByLabel("Volume (ml)").fill("500");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Bol · 500 ml")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/add?slot=lunch");
  await page
    .getByLabel("Choisir une photo")
    .setInputFiles({ name: "repas.png", mimeType: "image/png", buffer: MEAL_PNG });
  await expect(page.getByRole("img", { name: "Photo de ton repas" })).toBeVisible();
  await page.getByLabel("Une précision ? (facultatif)").fill("sauce à part");
  await page.getByLabel("Dans quel contenant ?").selectOption({ label: "Grand bol" });
  await page.getByRole("button", { name: "Analyser la photo" }).click();

  await expect(page.getByRole("heading", { name: "On vérifie ensemble ?" })).toBeVisible();
  await expect(page.getByText(/^Riz basmati, cuit/)).toBeVisible();
  await expect(page.getByText("Reconnu : riz basmati cuit")).toBeVisible();
  await page.getByLabel(/^Quantité de Riz basmati, cuit/).fill("150");
  await expect(page.getByText(/^Total : \d+ kcal$/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Ajouter au journal" }).click();

  await expect(page).toHaveURL(/\/journal\?date=/);
  const lunch = page.getByRole("region", { name: "Déjeuner" });
  await expect(lunch.getByText(/^Riz basmati, cuit/)).toBeVisible();
  await expect(lunch.getByText(/^150 g ·/)).toBeVisible();
  await expect(lunch.getByRole("img", { name: "Photo du déjeuner" })).toBeAttached();
});

test("saisie en texte libre, puis par le dictionnaire personnel sans appel à l'IA", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/add?slot=dinner");
  await page.getByLabel("Ou décris ton repas").fill("riz et poulet");
  await page.getByRole("button", { name: "Analyser", exact: true }).click();
  await expect(page.getByRole("heading", { name: "On vérifie ensemble ?" })).toBeVisible();
  await page.getByRole("button", { name: /^Retirer .*oulet/ }).click();
  await expect(page.getByRole("button", { name: /^Retirer / })).toHaveCount(1);
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Dîner" }).getByText(/^Riz basmati, cuit/)).toBeVisible();

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
  await page.getByLabel("Ou décris ton repas").fill("2 ma tartine");
  await page.getByRole("button", { name: "Analyser", exact: true }).click();
  await expect(page.getByText("Reconnu grâce à ton dictionnaire et à tes habitudes, sans appel à l'IA.")).toBeVisible();
  await expect(page.getByLabel(/^Quantité de Pain de mie, courant/)).toHaveValue("60");
  await page.getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page.getByRole("region", { name: "Petit-déjeuner" }).getByText(/^Pain de mie, courant/)).toBeVisible();
});

test("activation de la double authentification puis connexion avec un code", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/profile");
  const security = page.getByRole("region", { name: "Sécurité" });
  await security.getByLabel("Mot de passe").fill(ADMIN.password);
  await security.getByRole("button", { name: "Activer la double authentification" }).click();
  await expect(security.getByRole("img", { name: "QR code" })).toBeVisible();
  totpSecret = (await security.locator("code").textContent())!.trim();
  await security.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await security.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("La double authentification est activée.")).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/\/login\/two-factor$/);
  await page.getByLabel("Code à 6 chiffres").fill("000000");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(alertIn(page)).toHaveText("Code incorrect.");
  await page.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel !");
});

async function signInWithTotp(page: Page) {
  await signIn(page, ADMIN);
  await page.getByLabel("Code à 6 chiffres").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Adel !");
}

test("l'admin invite un membre mineur qui n'a pas accès à la perte de poids", async ({ page, browser }) => {
  await signInWithTotp(page);
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
  await next.click();
  await teen.getByLabel("Femme").check();
  await next.click();
  const fifteenYearsAgo = new Date();
  fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
  await teen.getByLabel("Date de naissance").fill(fifteenYearsAgo.toISOString().slice(0, 10));
  await next.click();
  await teen.getByLabel("Taille en cm").fill("160");
  await next.click();
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
  await teen.goto("/family");
  const pending = teen.getByRole("region", { name: "Repas partagés à valider" });
  await expect(pending.getByRole("heading", { name: "Gratin du dimanche" })).toBeVisible();
  await expect(pending.getByText(/^Adel a partagé ce plat pour le dîner/)).toBeVisible();
  await expect(teen.getByRole("region", { name: "Recettes du foyer" }).getByText("Gratin du dimanche")).toBeVisible();
  await expectNoA11yViolations(teen);
  await pending.getByText("½ part", { exact: true }).click();
  await expect(pending.getByText(/^Ça fait 75 g, \d+ kcal$/)).toBeVisible();
  await pending.getByRole("button", { name: "Ajouter à mon journal" }).click();
  await expect(teen.getByRole("region", { name: "Repas partagés à valider" })).toHaveCount(0);
  await teen.goto("/journal");
  await expect(teen.getByRole("region", { name: "Dîner" }).getByText(/^75 g ·/)).toBeVisible();
});

test("ressenti du jour et bilan qualité de la semaine", async ({ page }) => {
  await signInWithTotp(page);
  const checkin = page.getByRole("region", { name: "Comment tu te sens ?" });
  await withServerAction(page, () => checkin.getByRole("radio", { name: "Énergie : 4 sur 5" }).check({ force: true }));
  await expect(checkin.getByRole("radio", { name: "Énergie : 4 sur 5" })).toBeChecked();
  await expect(page.getByRole("progressbar", { name: "Fibres" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.reload();
  await expect(checkin.getByRole("radio", { name: "Énergie : 4 sur 5" })).toBeChecked();

  await page.getByRole("link", { name: "Bilan qualité" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bilan qualité");
  await expect(page.getByRole("heading", { name: "Idées pour la semaine" })).toBeVisible();
  // La pâte à tartiner scannée plus tôt est un produit ultra-transformé (NOVA 4).
  await expect(page.getByText(/Ultra-transformés les plus présents : .*Pâte à tartiner noisettes/)).toBeVisible();
  await expectNoA11yViolations(page);
});

test("coach : bilan, conversation (LLM simulé), garde-fou et personnalité", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Coach", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coach");
  // Le foyer de test vient d'être créé : pas assez de jours la semaine dernière pour un bilan.
  await expect(page.getByText(/Pas encore de bilan/)).toBeVisible();
  await expect(page.getByLabel("Serein")).toBeChecked();
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

  await withServerAction(page, () => page.getByLabel("Gourmand").check());
  await page.reload();
  await expect(page.getByLabel("Gourmand")).toBeChecked();
  await expect(conversation.getByText(/Tu me demandais/)).toBeVisible();

  await page.getByRole("button", { name: "Effacer la conversation" }).click();
  await expect(page.getByText(/Aucun message pour l'instant/)).toBeVisible();
});

test("menu de la semaine, liste de courses commune, recettes et scanner de frigo (LLM simulé)", async ({ page }) => {
  test.slow(); // parcours sur quatre écrans
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Menu de la semaine" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Menu de la semaine");
  const add = page.getByRole("region", { name: "Ajouter un plat" });
  await add.getByLabel("Repas").selectOption("dinner");
  await add.getByLabel("Recette du foyer").selectOption({ label: "Gratin du dimanche" });
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
  await expect(page.getByRole("region", { name: "Recettes du foyer" }).getByText("Gratin du dimanche")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recettes du foyer" }).getByText("Poêlée de lentilles aux carottes"),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/fridge");
  await page
    .getByLabel("Choisir une photo")
    .setInputFiles({ name: "frigo.png", mimeType: "image/png", buffer: MEAL_PNG });
  const omelette = page.getByRole("listitem", { name: "Omelette à la tomate" });
  await expect(omelette.getByText(/^\d+ kcal la portion · /)).toBeVisible();
  await expect(page.getByText(/^Repéré : œuf, tomate/)).toBeVisible();
  await expectNoA11yViolations(page);
  await omelette.getByRole("button", { name: "Enregistrer et ajouter au journal" }).click();
  await expect(page).toHaveURL(/\/add\?food=/);
  await expect(page.getByText("Omelette à la tomate").first()).toBeVisible();
});

test("mon métabolisme et budget hebdomadaire avec un jour plus large", async ({ page }) => {
  await signInWithTotp(page);
  await page.getByRole("link", { name: "Mon métabolisme" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon métabolisme");
  await expect(page.getByText(/il faut au moins 14 jours de suivi/)).toBeVisible();
  await expect(page.getByText("Calculé avec la formule de départ.")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Figer mon objectif" }).click();
  await expect(page.getByText(/Ton objectif est figé/)).toBeVisible();
  await page.getByRole("button", { name: "Laisser l'objectif s'ajuster" }).click();
  await expect(page.getByRole("button", { name: "Figer mon objectif" })).toBeVisible();

  await page.goto("/week");
  await expect(page.getByLabel("Budget quotidien")).toBeChecked();
  await page.getByLabel("Budget hebdomadaire").check();
  const days = page.getByRole("region", { name: "Jour par jour" });
  await expect(days.getByRole("progressbar", { name: "Cette semaine" })).toBeVisible();
  const lastDay = days.getByRole("checkbox", { name: /^Jour plus large/ }).last();
  await withServerAction(page, () => lastDay.check());
  await expect(lastDay).toBeChecked();
  await expectNoA11yViolations(page);
  await page.reload();
  await expect(days.getByRole("checkbox", { name: /^Jour plus large/ }).last()).toBeChecked();

  await page.goto("/");
  await expect(page.getByRole("progressbar", { name: "Cette semaine" })).toBeVisible();
  await expectNoA11yViolations(page);
  // Retour au budget quotidien pour les tests suivants.
  await page.goto("/week");
  await page.getByLabel("Budget quotidien").check();
  await expect(page.getByRole("region", { name: "Jour par jour" })).toHaveCount(0);
});

test("export des données en JSON et CSV", async ({ page }) => {
  await signInWithTotp(page);
  await page.goto("/profile");
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
  expect(csv.suggestedFilename()).toMatch(/^satia-export-.*\.zip$/);
});

test("un membre supprime son compte ; le dernier admin ne peut pas", async ({ page, browser }) => {
  const teen = await newPage(browser);
  await signIn(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await teen.goto("/profile");
  const danger = teen.getByRole("region", { name: "Supprimer mon compte" });
  await danger.getByLabel("Mot de passe").fill("nouveau-mot-de-passe-lea");
  await danger.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(teen).toHaveURL(/\/login$/);
  await submitLogin(teen, { email: TEEN.email, password: "nouveau-mot-de-passe-lea" });
  await expect(alertIn(teen)).toHaveText("E-mail ou mot de passe incorrect.");

  await signInWithTotp(page);
  await page.goto("/profile");
  const own = page.getByRole("region", { name: "Supprimer mon compte" });
  await own.getByLabel("Mot de passe").fill(ADMIN.password);
  await own.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(own.getByRole("alert")).toHaveText("Le dernier administrateur du foyer ne peut pas être supprimé.");
});
