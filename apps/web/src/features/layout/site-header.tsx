"use client";

import { ConfigLauncher } from "@/features/config/config-launcher";
import { LogoMark } from "@/features/layout/logo";
import { isActivePath, navLinks } from "@/features/layout/nav";
import { ThemeToggle } from "@/features/layout/theme-toggle";
import { cn } from "@symm-frontier/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border/60 bg-background/70 supports-backdrop-filter:bg-background/55 sticky top-0 z-50 w-full border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Symmio Frontier — home">
          <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-foreground text-base font-semibold tracking-tight">Symmio</span>
            <span className="text-muted-foreground hidden text-[10px] font-medium tracking-[0.22em] uppercase sm:inline">
              Frontier
            </span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
                {active ? (
                  <span className="bg-primary absolute inset-x-3 -bottom-px h-0.5 rounded-full" aria-hidden />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ConfigLauncher />
          <ThemeToggle />
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
        <nav className="border-border/60 bg-background/95 animate-enter-fade border-t backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {navLinks.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active ? <span className="bg-primary size-1.5 rounded-full" aria-hidden /> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
