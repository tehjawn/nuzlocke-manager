import type { Metadata } from "next";
import { Nunito, Rubik, JetBrains_Mono } from "next/font/google";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { getDatabaseHealth } from "@/lib/db-health";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const display = Rubik({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Trash Pack's Nuzlocke Challenge Manager",
    template: "%s · Nuzlocke Manager",
  },
  description:
    "Trash Pack's Nuzlocke Challenge Manager — league boards, graves, badges, and season archives.",
};

/** Always hit the live DB health probe — never bake a stale maintenance page. */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const health = await getDatabaseHealth();

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-ink">
        {health.ok ? children : <MaintenanceScreen health={health} />}
      </body>
    </html>
  );
}
