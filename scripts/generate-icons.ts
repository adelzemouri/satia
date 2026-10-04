/**
 * Génère les icônes PNG de la PWA à partir des SVG de `public/icons`.
 * Génère aussi les écrans de lancement iOS dans `public/splash`.
 * Usage : pnpm icons (nécessite un Chromium Playwright).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

import { BRAND_COLORS } from "../src/config/app";
import { SPLASH_SCREENS } from "../src/config/splash";

const targets = [
  { src: "public/icons/icon.svg", out: "public/icons/icon-192.png", size: 192 },
  { src: "public/icons/icon.svg", out: "public/icons/icon-512.png", size: 512 },
  { src: "public/icons/icon.svg", out: "public/icons/apple-touch-icon.png", size: 180 },
  { src: "public/icons/icon-maskable.svg", out: "public/icons/icon-maskable-512.png", size: 512 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const { src, out, size } of targets) {
  const svg = await readFile(src, "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await writeFile(out, await page.screenshot({ omitBackground: true }));
  console.log(`✓ ${out}`);
}
await browser.close();

// --- Écrans de lancement iOS -------------------------------------------------------------
// Sans eux, l'app installée sur iPhone affiche un écran blanc le temps du premier chargement.
// Une image par taille d'écran (portrait), en clair et en sombre. Le nom est écrit avec la police
// de l'app, prise dans la build (`pnpm build` avant `pnpm icons`), sinon une police système.

const media = await readdir(".next/static/media").catch(() => [] as string[]);
const fontFile = media.find((name) => name.includes(".p.") && name.endsWith(".woff2"));
const font = fontFile ? (await readFile(`.next/static/media/${fontFile}`)).toString("base64") : null;
const icon = await readFile("public/icons/icon.svg", "utf8");

const splashBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const splash = await splashBrowser.newPage();
for (const screen of SPLASH_SCREENS) {
  for (const theme of ["light", "dark"] as const) {
    await splash.setViewportSize({ width: screen.width, height: screen.height });
    await splash.setContent(`<html><head><style>
      ${font ? `@font-face{font-family:Brand;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}` : ""}
      body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${screen.dpr * 16}px;
        background:${BRAND_COLORS[theme]};font-family:Brand,system-ui,sans-serif}
      svg{width:${screen.dpr * 104}px;height:${screen.dpr * 104}px}
      p{margin:0;font-size:${screen.dpr * 30}px;font-weight:800;letter-spacing:-0.02em;color:${theme === "light" ? "#14201D" : "#EEF3F1"}}
    </style></head><body>${icon}<p>Pommelia</p></body></html>`);
    await splash.evaluate(() => document.fonts.ready);
    const out = `public/splash/${theme}-${screen.width}x${screen.height}.png`;
    await writeFile(out, await splash.screenshot());
    console.log(`✓ ${out}`);
  }
}
await splashBrowser.close();
