import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { Footer, Layout, Navbar, ThemeSwitch } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import { Banner, Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import { siteLinks, siteName, siteUrl, twitterSite } from "../lib/site";
import "./globals.css";
import { LibrarySwitcher } from "./library-switcher";
import { SymmioLogo } from "./logo";

/** Heading face — headings and the wordmark (Explorer uses Inter; matches apps/web). */
const display = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** UI / body face — labels, prose, controls. */
const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

/** Data face — code, addresses, figures. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

/**
 * Site-wide metadata. `canonical` and `og:url` are "./", which Next resolves against
 * each page's own pathname (with the `trailingSlash` slash), so every page declares
 * itself canonical. `openGraph` deliberately omits `title`/`description`: Next fills
 * both, and the Twitter card, from each page's own title and description (the
 * per-page descriptions come from the remark plugin in `next.config.mjs`). Never
 * export `openGraph` or `alternates` from a child segment — the shallow merge would
 * drop the url, site name, and image set here.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description:
    "Documentation for the SYMMIO SDK: guides and API reference for @symmio/trading-core, @symmio/trading-react, @symmio/utils and @symmio/session-key.",
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName, locale: "en_US", url: "./" },
  twitter: { card: "summary_large_image", site: twitterSite },
};

const banner = (
  <Banner storageKey="symmio-banner">
    <span className="symm-banner-dot" aria-hidden />
    Symmio Trading-SDK — the SDK surface for builders on Arbitrum
  </Banner>
);

/**
 * Nextra 4 search is powered by Pagefind, which indexes the built HTML output
 * into `public/_pagefind` (gitignored, regenerated per build). The input itself
 * is safe to render everywhere — Pagefind only loads lazily on interaction — so
 * the real `<Search />` ships in `next dev` too. Without a local build the index
 * is absent and typing surfaces `errorText`; run `pnpm --filter @symmio/docs preview`
 * (build + start) to index the site and search for real.
 */
const search = (
  <Search errorText="Search index not found. It is generated at build time — run `pnpm --filter @symmio/docs preview` to enable search locally." />
);

const navbar = (
  <Navbar logo={<SymmioLogo />} logoLink="/" projectLink={siteLinks.github}>
    <ThemeSwitch lite />
  </Navbar>
);

/**
 * Scopes the sidebar to the active library before first paint so the other
 * libraries never flash in. Mirrors the logic in `library-switcher.tsx`: the
 * current route wins, otherwise the last-picked library, otherwise Core.
 */
const scopeSidebarScript = `try {
  var libs = ["core", "react", "utils", "session-key"];
  var seg = location.pathname.split("/").filter(Boolean)[0];
  var lib = libs.indexOf(seg) > -1 ? seg : (localStorage.getItem("symmio-docs-library") || "core");
  document.documentElement.setAttribute("data-doc-lib", lib);
} catch (e) {}`;

const footer = (
  <Footer>
    <div className="symm-footer">
      <SymmioLogo />
      <span className="symm-footer__tag">
        The SYMMIO SDK surface for builders — connect a wallet, inspect contract state, and trade on Arbitrum.
      </span>
      {/* Crawlable links to the sibling sites — the footer renders on every page,
          including mobile, where navbar children are hidden. */}
      <nav className="symm-footer__links" aria-label="SYMMIO Trading-SDK sites">
        <a href={siteLinks.landing}>Website</a>
        <a href={siteLinks.console}>SDK console</a>
        <a href={siteLinks.github}>GitHub</a>
      </nav>
      <span className="symm-footer__meta">
        © {new Date().getFullYear()} Symmio Trading-SDK · built with <strong>@symmio</strong>
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
      {/* Favicon comes from the file-based metadata icons (app/icon.svg +
          app/favicon.ico), so no faviconGlyph here — that would inject a
          competing emoji <link>. */}
      <Head
        color={{
          hue: 6,
          saturation: { dark: 100, light: 80 },
          lightness: { dark: 72, light: 42 },
        }}
        backgroundColor={{ dark: "#0a0505", light: "#fbf9f8" }}
      />
      <body>
        <script dangerouslySetInnerHTML={{ __html: scopeSidebarScript }} />
        <Layout
          banner={banner}
          navbar={navbar}
          search={search}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/SYMM-IO/Trading-SDK/tree/main/apps/docs"
          nextThemes={{ attribute: "class", defaultTheme: "dark" }}
          sidebar={{ defaultMenuCollapseLevel: 1, autoCollapse: true }}
        >
          <LibrarySwitcher />
          {children}
        </Layout>
      </body>
    </html>
  );
}
