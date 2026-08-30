"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

export interface RouteTabItem {
  href: string;
  label: string;
  /** Match the pathname exactly rather than by prefix. Set on a parent route that has child routes. */
  exact?: boolean;
  /** Rendered after the label, e.g. a count. */
  badge?: ReactNode;
}

export interface RouteTabsProps {
  items: readonly RouteTabItem[];
  /**
   * Names the `<nav>` landmark. Required, and deliberately so: two strips render
   * as siblings on the portfolio pages, and a default would give both landmarks
   * the same name — which is the one thing a landmark name exists to prevent.
   */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A `Segmented`-shaped tab strip whose cells are real links.
 *
 * ## Why a second control that looks like the first
 *
 * Every other tab strip in Prism is `Segmented` over a `useState`, and that is
 * right where the tabs are views of one screen: switching them costs one
 * request and nothing about the URL changed. It is wrong once a tab owns a
 * *page* — a reward history, a transfers ledger, a market-config editor — where
 * the reader expects a back button, a reload that lands where they were, and a
 * link they can send. Those are route concerns, so the cells are `<Link>`s and
 * the active cell is derived from the pathname rather than held in state.
 *
 * The visual language is deliberately identical to `Segmented`: the same track,
 * the same pill, the same two sizes. A tab strip should not announce which
 * mechanism happens to sit behind it.
 *
 * ## Matching
 *
 * A tab lights when the pathname *is* its href, or sits underneath it. That
 * prefix rule is what keeps a parent lit while a child page is open — and it is
 * exactly what a parent with its own page does **not** want, because then both
 * the parent and the child cell light at once. Such a parent sets `exact`.
 *
 * The prefix test appends a slash on purpose: a bare `startsWith` would light
 * `/pools/portfolio` for a sibling route named `/pools/portfolio-archive`.
 *
 * ## Naming the landmark
 *
 * Each strip is a `<nav>`, so each one shows up in a screen reader's landmark
 * list — and the portfolio pages stack two of them, the section strip and the
 * strip inside it. Sighted readers tell those apart by size and position, which
 * the landmark list does not carry, so the name is the only thing left to tell
 * them apart with. That is why `label` is a required prop rather than one with
 * a sensible default: a shared default would put two identically named `<nav>`s
 * on the same page, which is exactly the ambiguity a name is there to remove.
 */
export function RouteTabs({ items, label, size = "md", className }: RouteTabsProps): ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-md border border-line bg-bg-0 p-[3px]", className)}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border font-sans whitespace-nowrap",
              "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
              size === "sm" ? "h-6 px-2.5 text-sm" : "h-[30px] px-3 text-sm",
              active
                ? "border-line-strong bg-bg-3 font-semibold text-fg-0"
                : "border-transparent text-fg-3 hover:text-fg-1",
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge !== null ? (
              /* The badge is muted even on the active cell: it is a count, and a
                 count that competes with its own label turns the strip into a
                 row of numbers. */
              <span className="tnum text-2xs text-fg-3">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
