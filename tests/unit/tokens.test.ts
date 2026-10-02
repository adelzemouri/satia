import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** Vérifie les contrastes WCAG AA des design tokens, en thème clair et sombre. */
const css = readFileSync("src/ui/tokens.css", "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string, number][] = [
  ["color-text", "color-bg", 4.5],
  ["color-text", "color-surface", 4.5],
  ["color-text", "color-surface-muted", 4.5],
  ["color-text", "color-primary-soft", 4.5],
  ["color-text-muted", "color-bg", 4.5],
  ["color-text-muted", "color-surface", 4.5],
  ["color-on-primary", "color-primary", 4.5],
  ["color-on-accent", "color-accent", 4.5],
  ["color-accent", "color-bg", 4.5],
  ["color-protein", "color-surface", 4.5],
  ["color-carbs", "color-surface", 4.5],
  ["color-fat", "color-surface", 4.5],
  ["color-focus", "color-bg", 3],
];

describe.each([
  ["clair", block('[data-theme="light"]')],
  ["sombre", block('[data-theme="dark"]')],
])("tokens du thème %s", (_name, tokens) => {
  it.each(PAIRS)("%s sur %s respecte le ratio %d", (fg, bg, min) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it("le thème sombre système reprend exactement le thème sombre explicite", () => {
  expect(block(':root:not([data-theme="light"])')).toEqual(block('[data-theme="dark"]'));
});
