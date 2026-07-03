import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import "./globals.css";
import { SymmioLogo } from "./logo";

/** Editorial display face — headings and the wordmark (matches apps/web). */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

/** UI / body face — labels, prose, controls. */
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

/** Data face — code, addresses, figures. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Symmio Frontier — SDK reference",
    template: "%s · Symmio Frontier",
  },
  description:
    "The SYMMIO SDK surface for builders — connect a wallet, inspect contract state, and trade on HyperEVM without re-implementing the plumbing.",
};

const banner = (
  <Banner storageKey="symm-frontier-banner">
    <span className="symm-banner-dot" aria-hidden />
    Symmio Frontier — the SDK surface for builders on HyperEVM
  </Banner>
);

const navbar = <Navbar logo={<SymmioLogo />} logoLink="/" projectLink="https://github.com/SYMM-IO" />;

const footer = (
  <Footer>
    <div className="symm-footer">
      <SymmioLogo />
      <span className="symm-footer__tag">
        The SYMMIO SDK surface for builders — connect a wallet, inspect contract state, and trade on HyperEVM.
      </span>
      <span className="symm-footer__meta">
        © {new Date().getFullYear()} Symmio Frontier · built with <strong>@symmio</strong>
      </span>
    </div>
  </Footer>
);

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <Head
        color={{
          hue: 225,
          saturation: { dark: 100, light: 80 },
          lightness: { dark: 62, light: 54 },
        }}
        backgroundColor={{ dark: "#0a0b0f", light: "#f7f8fa" }}
        faviconGlyph="▲"
      />
      <body>
        <Layout
          banner={banner}
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/shuding/nextra/tree/main/docs"
          nextThemes={{ attribute: "class", defaultTheme: "dark" }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
