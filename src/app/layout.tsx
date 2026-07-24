import type { Metadata } from "next";
import { Nunito, Rubik, JetBrains_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
