import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SnackbarHost } from "@/components/Snackbar";
import { JumpHost } from "@/features/jump/JumpHost";
import { challengeToJumpSeasonContext } from "@/features/jump/jump-season";
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

export const metadata: Metadata = {
  title: {
    default: "Trash Pack's Nuzlocke Challenge Manager",
    template: "%s · Nuzlocke Manager",
  },
  description:
    "Trash Pack's Nuzlocke Challenge Manager — league boards, graves, badges, and season archives.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultChallenge = await getDefaultJumpChallenge();
  const defaultSeason = defaultChallenge
    ? challengeToJumpSeasonContext(defaultChallenge)
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
        <NavigationProgress />
        <JumpHost defaultSeason={defaultSeason}>
          {children}
          <SnackbarHost />
        </JumpHost>
      </body>
    </html>
  );
}
