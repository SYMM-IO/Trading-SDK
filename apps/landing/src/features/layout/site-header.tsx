"use client";

import { LiveDot } from "@/components/live-dot";
import { LogoMark } from "@/features/layout/logo";
import { ThemeToggle } from "@/features/layout/theme-toggle";
import { routes, sectionAnchors, siteLinks } from "@/lib/site";
import { Button } from "@symmio/ui/components/button";
import { cn } from "@symmio/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

/**
 * Every internal entry is root-relative, so the nav works identically on the
 * home page and on `/affiliate`. Internal links render as `next/link` for
 * client-side navigation; only `external` ones stay plain anchors.
 */
const navLinks: NavLink[] = [
  { label: "The SDK", href: sectionAnchors.sdk },
  { label: "Libraries", href: sectionAnchors.libraries },
  { label: "Apps", href: sectionAnchors.apps },
  { label: "Affiliate", href: routes.affiliate },
  { label: "Docs", href: siteLinks.docs, external: true },
];

const navLinkClass =
  "text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

/**
 * Fixed, glass site header. Stays transparent over the hero and condenses into
 * a bordered, blurred bar once the page scrolls — the same "settle on scroll"
 * gesture the console uses, so the two surfaces feel related.
 */
export function SiteHeader() {
  const scrolled = useScrolled(12);
  const [open, setOpen] = useState(false);

  /**
   * While the mobile drawer is open, lock background scroll and let Escape
   * dismiss it — a full-screen overlay should behave like a modal.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-border/60 bg-background/70 supports-backdrop-filter:bg-background/55 border-b backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={sectionAnchors.top}
          className="group flex items-center gap-2.5"
          aria-label="Symmio Trading-SDK — home"
        >
          <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-foreground text-base font-semibold tracking-tight">Symmio</span>
            <span className="text-muted-foreground hidden text-[10px] font-medium tracking-[0.22em] uppercase sm:inline">
              Trading-SDK
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={navLinkClass}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={navLinkClass}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={siteLinks.github}
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 hidden size-9 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3 sm:inline-flex"
          >
            <GitHubIcon />
          </a>
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href={siteLinks.console} target="_blank" rel="noreferrer">
              Open console
            </a>
          </Button>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 inline-flex size-9 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
              {open ? (
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-60 md:hidden" role="dialog" aria-modal="true" aria-label="Site menu">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="bg-background/70 animate-in fade-in absolute inset-0 backdrop-blur-sm duration-200"
          />

          <div className="border-border/60 bg-background animate-in slide-in-from-right fade-in relative isolate ml-auto flex h-dvh w-full flex-col border-l duration-300 ease-out">
            <div className="drawer-atmos pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
              <div className="drawer-aurora-b" />
              <div className="drawer-aurora-a" />
              <div className="drawer-grid" />
              <div className="drawer-scrim" />
            </div>

            <div className="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6">
              <Link
                href={sectionAnchors.top}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2.5"
                aria-label="Symmio Trading-SDK — home"
              >
                <LogoMark />
                <span className="flex items-baseline gap-1.5">
                  <span className="font-display text-foreground text-base font-semibold tracking-tight">Symmio</span>
                  <span className="text-muted-foreground text-[10px] font-medium tracking-[0.22em] uppercase">
                    Trading-SDK
                  </span>
                </span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 ml-auto inline-flex size-9 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4 sm:px-6">
              {navLinks.map((link) => {
                const className =
                  "text-foreground/90 hover:bg-muted hover:text-foreground flex items-center justify-between rounded-2xl px-4 py-3.5 text-lg font-medium transition-colors";
                const content = (
                  <>
                    {link.label}
                    <svg viewBox="0 0 24 24" fill="none" className="text-muted-foreground size-4" aria-hidden>
                      <path
                        d={link.external ? "M7 17 17 7M9 7h8v8" : "m9 6 6 6-6 6"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                );

                return link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className={className}
                  >
                    {content}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={className}>
                    {content}
                  </Link>
                );
              })}
            </nav>

            <div className="border-border/60 flex shrink-0 flex-col gap-4 border-t px-4 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <LiveDot tone="positive" />
                <span className="text-muted-foreground text-xs font-medium">HyperEVM · Base · Live</span>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild className="flex-1">
                  <a href={siteLinks.console} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                    Open console
                  </a>
                </Button>
                <a
                  href={siteLinks.github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Source on GitHub"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3"
                >
                  <GitHubIcon />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/** True once the window has scrolled past `threshold` pixels. */
function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.34 9.34 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
