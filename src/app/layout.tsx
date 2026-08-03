import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SnackbarHost } from "@/components/Snackbar";
import { CelebrationHost } from "@/features/fx/CelebrationHost";
import { JumpHost } from "@/features/jump/JumpHost";
import { briefToJumpSeasonContext } from "@/features/jump/jump-season";
import { PokemonSpritePreferenceProvider } from "@/features/preferences/PokemonSpritePreferenceProvider";
import { getDefaultJumpChallenge } from "@/lib/challenges";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Single modern face for the whole app. */
const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

/**
 * Explicit viewport so mobile browser chrome matches the app background in each
 * theme. `width=device-width, initial-scale=1` is the App Router default; we
 * deliberately omit maximum-scale / user-scalable so pinch-zoom stays available.
 * themeColor values mirror --bg (light #eef2e6 / dark #0a0e0b) from globals.css.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e0b" },
  ],
};

const SITE_URL = "https://nuzlocke-manager.vercel.app";
const SITE_TITLE = "Trash Pack's Nuzlocke Challenge Manager";
const SITE_DESCRIPTION =
  "Trash Pack's Nuzlocke Challenge Manager — league boards, graves, badges, and season archives.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Nuzlocke Manager",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Nuzlocke Manager",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cached season brief only — GM membership is request-time and is applied
  // from SiteHeaderSession (Suspense) on global pages / SeasonJumpRegistrar
  // on challenge pages.
  const defaultChallenge = await getDefaultJumpChallenge();
  const defaultSeason = defaultChallenge
    ? briefToJumpSeasonContext(defaultChallenge)
    : null;

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-ink">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <PokemonSpritePreferenceProvider>
          <JumpHost defaultSeason={defaultSeason}>
            {children}
            <SiteFooter />
            <SnackbarHost />
            <CelebrationHost />
          </JumpHost>
        </PokemonSpritePreferenceProvider>
      </body>
    </html>
  );
}
