/**
 * Écrans de lancement de l'app installée sur iPhone (taille en pixels, portrait) : générés par
 * `pnpm icons` dans `public/splash`, déclarés dans les métadonnées de la page.
 */
export const SPLASH_SCREENS = [
  { width: 1320, height: 2868, dpr: 3 },
  { width: 1206, height: 2622, dpr: 3 },
  { width: 1290, height: 2796, dpr: 3 },
  { width: 1179, height: 2556, dpr: 3 },
  { width: 1284, height: 2778, dpr: 3 },
  { width: 1170, height: 2532, dpr: 3 },
  { width: 1125, height: 2436, dpr: 3 },
  { width: 1242, height: 2688, dpr: 3 },
  { width: 828, height: 1792, dpr: 2 },
  { width: 1242, height: 2208, dpr: 3 },
  { width: 750, height: 1334, dpr: 2 },
] as const;

export function splashStartupImages(): { url: string; media: string }[] {
  return SPLASH_SCREENS.flatMap(({ width, height, dpr }) =>
    (["light", "dark"] as const).map((theme) => ({
      url: `/splash/${theme}-${width}x${height}.png`,
      media: `(device-width: ${width / dpr}px) and (device-height: ${height / dpr}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
    })),
  );
}
