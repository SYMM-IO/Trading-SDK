import { SiteFooter } from "@/features/layout/site-footer";
import { SiteHeader } from "@/features/layout/site-header";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Heading face — headings, the wordmark, and large figures (Explorer uses Inter). */
const display = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** UI / body face — labels, descriptions, controls. */
const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

/** Data face — install commands, code snippets, figures. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Symmio Frontier — the SYMMIO SDK for builders",
    template: "%s · Symmio Frontier",
  },
  description:
    "One SDK for the entire SYMMIO surface. @symmio/trading-core and trading-react wrap contracts, solvers, prices, and Muon behind a simple, correct, reliable API.",
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
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
