"use client";

import { PrismMark } from "@/components/prism-mark";
import { ToastProvider } from "@/components/toast";
import { AccountProvider } from "@/features/accounts/account-provider";
import { ModeCast } from "@/features/mode/mode-cast";
import { PriceProvider } from "@/features/prices/price-provider";
import { PositionsProvider } from "@/features/trade/positions-provider";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountBar } from "./account-bar";
import { ModeSwitch } from "./mode-switch";

const NAV = [
  { href: "/", label: "Trade" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/activity", label: "Activity" },
  { href: "/sdk", label: "SDK" },
] as const;

/** Top bar, navigation and the shared realtime providers. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ToastProvider>
      <PriceProvider>
        <AccountProvider>
          <PositionsProvider>
            <div className="flex h-dvh flex-col overflow-hidden bg-bg-0">
              <header className="relative z-30 shrink-0 border-b border-line-subtle bg-bg-1">
                {/* The mode strip: the one place all three identities appear together. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ background: "var(--mode-strip)" }}
                />

                <div className="flex h-14 items-stretch px-4">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5 rounded-md pr-1 transition-opacity duration-[var(--dur-fast)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <PrismMark size={22} />
                    <span className="font-display text-[17px] leading-none font-bold tracking-[-0.03em] whitespace-nowrap text-fg-0">
                      Prism
                    </span>
                  </Link>

                  <span aria-hidden className="mx-3 w-px self-center bg-line" style={{ height: 20 }} />

                  {/* Links stretch to the header's full height so the active
                      bar sits on its bottom edge, flush with the border — a
                      tab, not a pill floating in the middle of the bar. */}
                  <nav aria-label="Primary" className="flex items-stretch gap-0.5">
                    {NAV.map((item) => {
                      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative flex items-center px-3 text-md whitespace-nowrap",
                            "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                            "focus-visible:text-fg-0 focus-visible:outline-none",
                            "after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-t-sm after:bg-accent after:content-['']",
                            "after:origin-bottom after:transition-transform after:duration-[var(--dur-base)] after:ease-[var(--ease-out)]",
                            active
                              ? "font-semibold text-fg-0 after:scale-y-100"
                              : "text-fg-3 after:scale-y-0 hover:text-fg-1",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="ml-auto flex items-center gap-3">
                    <ModeSwitch />
                    <span aria-hidden className="w-px bg-line" style={{ height: 20 }} />
                    <AccountBar />
                  </div>
                </div>
              </header>

              {/* The shell owns the viewport; every screen scrolls inside this one
                  element. That is what lets the trade page bound itself to
                  `h-full` without subtracting a hard-coded header height that
                  silently goes stale the moment the header's padding changes. */}
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

              {/* Sits outside the header/main split on purpose: the reveal is
                  fixed to the viewport, not to a region, and it must be able to
                  paint over both. */}
              <ModeCast />
            </div>
          </PositionsProvider>
        </AccountProvider>
      </PriceProvider>
    </ToastProvider>
  );
}
