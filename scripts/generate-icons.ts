/**
 * Génère les icônes PNG de la PWA à partir des SVG de `public/icons`.
 * Usage : pnpm icons (nécessite un Chromium Playwright).
 */
import { readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

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
