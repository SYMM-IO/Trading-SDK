"use client";

import { ConfigLauncher } from "@/features/config/config-launcher";
import { LogoMark } from "@/features/layout/logo";
import { isActivePath, primaryNavLinks, secondaryNavGroups, type NavLink } from "@/features/layout/nav";
import { NavMoreMenu } from "@/features/layout/nav-more-menu";
import { ThemeToggle } from "@/features/layout/theme-toggle";
import { MagicSidebarLauncher } from "@/features/magic-sidebar/magic-sidebar-launcher";
import { useMagicSidebar } from "@/features/magic-sidebar/magic-sidebar-store";
import { useSidebarMetrics } from "@/features/magic-sidebar/use-sidebar-metrics";
import { SearchLauncher } from "@/features/search/search-launcher";
import { WalletLauncher } from "@/features/wallet/wallet-launcher";
import { cn } from "@symmio/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The header is `fixed` (so a scroll-locking popup can't knock it out of view),
  // so unlike the in-flow content it doesn't inherit the dock's right gutter —
  // track it here so the header shrinks to sit flush beside the docked sidebar
  // instead of being overlaid. `pushPadding` is 0 when the sidebar is closed or
  // overlaying, so the header is full-width then.
  const { pushPadding } = useSidebarMetrics();
  const { isResizing } = useMagicSidebar();

  return (
    <header
      style={{ right: pushPadding }}
      className={cn(
        "border-border/60 bg-background/70 supports-backdrop-filter:bg-background/55 @container/header fixed top-0 left-0 z-50 border-b backdrop-blur-xl",
        isResizing ? null : "transition-[right] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 @min-[1090px]/header:px-8 @xl/header:gap-6 @xl/header:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Symmio Trading-SDK — home">
          <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-foreground hidden text-base font-semibold tracking-tight @sm/header:inline">
              Symmio
            </span>
            <span className="text-muted-foreground hidden text-[10px] font-medium tracking-[0.22em] uppercase @xl/header:inline">
              Trading-SDK
            </span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 @min-[960px]/header:flex">
          {primaryNavLinks.map((link) => {
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
          <NavMoreMenu />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchLauncher />
          <MagicSidebarLauncher />
          <ConfigLauncher />
          <ThemeToggle />
          <WalletLauncher />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 inline-flex size-9 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3 @min-[960px]/header:hidden"
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
        /*
         * The drawer lives inside the fixed header, so it can't scroll with the page — cap it
         * to the viewport below the 4rem bar and let it scroll on its own, or the last groups
         * are unreachable on a short phone or in landscape.
         */
        <nav className="border-border/60 bg-background/95 animate-enter-fade max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t backdrop-blur-xl @min-[960px]/header:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 @xl/header:px-6">
            <div className="flex flex-col gap-1">
              {primaryNavLinks.map((link) => (
                <MobileNavLink key={link.href} link={link} pathname={pathname} onNavigate={() => setOpen(false)} />
              ))}
            </div>
            <div className="gap-4 @xl/header:columns-2">
              {secondaryNavGroups.map((group) => (
                <div key={group.label} className="flex break-inside-avoid flex-col gap-1 pb-4 last:pb-0">
                  <span className="text-muted-foreground px-3 pb-1 text-xs font-medium">{group.label}</span>
                  {group.links.map((link) => (
                    <MobileNavLink key={link.href} link={link} pathname={pathname} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

/** One row in the mobile drawer: the label, an optional description, and the active marker. */
function MobileNavLink({ link, pathname, onNavigate }: { link: NavLink; pathname: string; onNavigate: () => void }) {
  const active = isActivePath(pathname, link.href);
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{link.label}</span>
        {link.description ? <span className="text-muted-foreground truncate text-xs">{link.description}</span> : null}
      </span>
      {active ? <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden /> : null}
    </Link>
  );
}
