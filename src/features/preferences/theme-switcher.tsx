"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { THEME_COOKIE, THEMES, type Theme } from "./theme";

function applyTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function ThemeSwitcher({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-text-muted">{t("label")}</legend>
      <div className="flex gap-1 rounded-full bg-surface-muted p-1">
        {THEMES.map((value) => (
          <label
            key={value}
            className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-focus)]"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => choose(value)}
              className="sr-only"
            />
            {t(value)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
