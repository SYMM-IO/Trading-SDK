import { LiveDot } from "@/components/live-dot";
import { LogoMark } from "@/features/layout/logo";
import { sectionAnchors, siteLinks } from "@/lib/site";
import Link from "next/link";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "SDK",
    links: [
      { label: "The two layers", href: sectionAnchors.sdk },
      { label: "Libraries", href: sectionAnchors.libraries },
      { label: "Get started", href: sectionAnchors.start },
      { label: "Documentation", href: siteLinks.docs, external: true },
    ],
  },
  {
    title: "Apps",
    links: [
      { label: "Web console", href: siteLinks.console, external: true },
      { label: "Docs site", href: siteLinks.docs, external: true },
      { label: "Storybook", href: siteLinks.storybook, external: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: siteLinks.github, external: true },
      { label: "SYMMIO protocol", href: siteLinks.protocol, external: true },
    ],
  },
];

/** Site footer — brand block, three link columns, and a fine legal rule. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/60 mt-28 border-t">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-4">
            <Link href={sectionAnchors.top} className="flex items-center gap-2.5">
              <LogoMark className="h-7 w-auto" />
              <span className="font-display text-foreground text-base font-semibold tracking-tight">
                Symmio Trading-SDK
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-6">
              One SDK for the entire SYMMIO surface — contracts, solvers, prices, and Muon, wrapped behind a simple,
              correct, reliable API.
            </p>
            <span className="border-border/70 bg-muted/40 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium">
              <LiveDot tone="positive" />
              HyperEVM · Base · Live
            </span>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} className="flex flex-col gap-3">
                <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
                  {column.title}
                </span>
                <div className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </nav>
            ))}
          </div>
        </div>

        <div className="border-border/60 text-muted-foreground mt-12 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Symmio Trading-SDK</span>
          <span className="font-mono">
            built with <span className="text-foreground">@symmio</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
