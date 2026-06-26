import { SiteFooter } from "@/features/layout/site-footer";
import { SiteHeader } from "@/features/layout/site-header";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Editorial display face — headings, the wordmark, and large figures. */
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

/** UI / body face — labels, descriptions, controls. */
const sans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

/** Data face — addresses, tx hashes, figures, ABI names. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Symmio Frontier",
    template: "%s · Symmio Frontier",
  },
  description: "The SYMMIO SDK surface for builders — connect, inspect, and trade on HyperEVM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <SiteHeader />
          {/* Offsets the now-fixed SiteHeader (h-16). Fixed (not sticky) so a
              scroll-locking popup — Radix Select/Dialog sets `body { overflow: hidden }`
              — can't knock the header out of its scroll context and hide it. */}
          <main className="flex-1 pt-16">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
