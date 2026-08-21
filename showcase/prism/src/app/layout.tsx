import { AppShell } from "@/features/layout/app-shell";
import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Prism — one app, every perp",
  description:
    "A multi-solver perpetuals DEX built entirely on the SYMMIO SDK. Majors and lowcaps in one book, one ticket, one keystroke.",
};

/** Paints the browser chrome in the app's base surface on mobile. */
export const viewport: Viewport = {
  themeColor: "#191a21",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mode="unified" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${geist.variable} ${jetBrainsMono.variable}`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
