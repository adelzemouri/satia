import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
/** Open Food Facts simulé (tests/e2e/off-mock.mjs) : les tests n'appellent jamais le vrai service. */
const offMock = `http://localhost:${Number(process.env.OFF_MOCK_PORT ?? 3199)}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Les parcours partagent une même base : exécution en série, dans l'ordre des fichiers.
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          ...(process.env.CHROMIUM_PATH && { executablePath: process.env.CHROMIUM_PATH }),
          // Caméra simulée pour l'écran de scan.
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  // Teste le build de production (service worker inclus), pas le serveur de dev.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: "node tests/e2e/off-mock.mjs", url: `${offMock}/health`, reuseExistingServer: !process.env.CI },
        {
          command: `PORT=${port} OFF_BASE_URL=${offMock} OFF_SEARCH_URL=${offMock} pnpm start:standalone`,
          url: `${baseURL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
