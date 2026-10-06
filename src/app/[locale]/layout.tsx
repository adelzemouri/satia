import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME, BRAND_COLORS } from "@/config/app";
import { splashStartupImages } from "@/config/splash";
import { CHUNK_RECOVERY_SCRIPT } from "@/features/offline/chunk-recovery";
import { parseTheme, THEME_COOKIE } from "@/features/preferences/theme";
import { routing } from "@/i18n/routing";

import "../globals.css";

// Texte courant net et lisible sur téléphone ; titres et grands chiffres en Fraunces arrondie.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const title = Fraunces({ subsets: ["latin"], axes: ["SOFT", "opsz"], variable: "--font-title", display: "swap" });

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "fr", namespace: "meta" });
  return {
    applicationName: APP_NAME,
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("description"),
    appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME, startupImage: splashStartupImages() },
    formatDetection: { telephone: false },
    icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.dark },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-theme={theme === "system" ? undefined : theme}
      className={`${sans.variable} ${title.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
      </head>
      <body className="min-h-full bg-bg text-text">
        <NextIntlClientProvider>
          <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
            {children}
          </SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
