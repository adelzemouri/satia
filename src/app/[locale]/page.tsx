import { cookies } from "next/headers";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { APP_NAME } from "@/config/app";
import { LanguageSwitcher } from "@/features/preferences/language-switcher";
import { parseTheme, THEME_COOKIE } from "@/features/preferences/theme";
import { ThemeSwitcher } from "@/features/preferences/theme-switcher";
import { toLocale } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <Home theme={theme} />;
}

function Home({ theme }: { theme: ReturnType<typeof parseTheme> }) {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône SVG statique */}
        <img src="/icons/icon.svg" alt="" width={48} height={48} />
        <span className="font-display text-2xl font-semibold">{APP_NAME}</span>
      </header>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-4xl font-semibold">{t("home.greeting")}</h1>
        <p className="text-lg">{t("home.tagline")}</p>
        <p className="self-start rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-text">
          {t("home.status")}
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <ThemeSwitcher initialTheme={theme} />
        <LanguageSwitcher />
      </section>

      <footer className="mt-auto text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</footer>
    </main>
  );
}
