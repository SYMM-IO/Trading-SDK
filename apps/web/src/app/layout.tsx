import { SiteFooter } from "@/features/layout/site-footer";
import { SiteHeader } from "@/features/layout/site-header";
import { siteName, siteUrl, twitterSite } from "@/lib/site";
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

/** Data face — addresses, tx hashes, figures, ABI names. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Site-wide metadata. `canonical` and `og:url` are "./", which Next resolves
 * against each page's own pathname, so every page declares itself canonical (this
 * also points search engines away from the `*.vercel.app` copy). `openGraph`
 * deliberately omits `title`/`description`: Next fills both, and the Twitter card,
 * from each page's own title and description. Never export `openGraph` or
 * `alternates` from a page — the shallow merge would drop the url, site name, and
 * image set here. The title names the console so it never competes with the
 * landing site for the SDK's own searches.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${siteName} — try the SYMMIO SDK live`,
    template: `%s · ${siteName}`,
  },
  description:
    "Try the SYMMIO SDK live: connect a wallet, run contract reads and writes, stream prices, candles and order books, and walk end-to-end trading flows.",
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName, locale: "en_US", url: "./" },
  twitter: { card: "summary_large_image", site: twitterSite },
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
