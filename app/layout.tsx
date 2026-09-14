import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Script from "next/script";
import { brandSiteUrl, productBrand } from "@/lib/product/brand";
import { LanguageProvider } from "@/app/i18n/LanguageProvider";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { UI_LANGUAGE_COOKIE } from "@/lib/i18n/registry";
import { resolveUiLanguage } from "@/lib/i18n/resolve";
import { parseThemeMode, THEME_BOOT_SCRIPT, THEME_COOKIE } from "@/lib/theme/preference";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: brandSiteUrl(),
  title: `${productBrand.productName} — ${productBrand.tagline}`,
  description: productBrand.description,
  applicationName: productBrand.productName,
  icons: {
    icon: productBrand.favicon,
    shortcut: productBrand.favicon,
    apple: productBrand.logo,
  },
  openGraph: {
    title: `${productBrand.productName} — ${productBrand.tagline}`,
    description: productBrand.description,
    siteName: productBrand.productName,
    images: [{ url: productBrand.ogImage, alt: `${productBrand.productName} — ${productBrand.tagline}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${productBrand.productName} — ${productBrand.tagline}`,
    description: productBrand.description,
    images: [productBrand.ogImage],
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const language = resolveUiLanguage({ storedLanguage: jar.get(UI_LANGUAGE_COOKIE)?.value });
  const themeMode = parseThemeMode(jar.get(THEME_COOKIE)?.value);
  const serverTheme = themeMode === "system" ? undefined : themeMode;
  return (
    <html
      lang={language.locale}
      dir={language.direction}
      data-theme={serverTheme}
      data-theme-mode={themeMode}
      suppressHydrationWarning
    >
      <head>
        <Script id="nx-theme" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
      </head>
      <body className="font-body antialiased">
        <ThemeProvider initialMode={themeMode}>
          <LanguageProvider initialLanguage={language.code}>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
