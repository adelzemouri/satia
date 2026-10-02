import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Base vide : toute page protégée renvoie vers l'installation.

test("une première visite mène à l'installation, en français par défaut", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Installation");
});

test("l'anglais est disponible", async ({ page }) => {
  await page.goto("/en/setup");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Setup");
});

for (const theme of ["light", "dark"] as const) {
  test(`aucune violation d'accessibilité WCAG AA en thème ${theme}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: theme, url: baseURL! }]);
    await page.goto("/setup");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("les en-têtes de sécurité et le nonce CSP sont présents", async ({ page }) => {
  const response = await page.goto("/setup");
  const headers = response!.headers();
  const csp = headers["content-security-policy"]!;
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-frame-options"]).toBe("DENY");
  const scripts = await page
    .locator("script[src]")
    .evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  for (const value of scripts) expect(value).toBe(nonce);
});

test("les routes protégées exigent une session", async ({ request }) => {
  expect((await request.get("/api/me/export")).status()).toBe(401);
});

test("la PWA est installable : manifest et service worker", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  await page.goto("/setup");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});

test("la page hors-ligne est servie par le service worker", async ({ page, context }) => {
  await page.goto("/setup");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/une-page-jamais-visitee").catch(() => undefined);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hors ligne");
  await context.setOffline(false);
});
