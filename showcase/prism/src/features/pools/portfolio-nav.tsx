import { RouteTabs, type RouteTabItem } from "@/components/route-tabs";

/**
 * The three questions an LP asks about their own liquidity.
 *
 * Pools is the ledger — what is in which pool right now. Rewards is what
 * that has paid and what has been taken out of it. Transfers is the money
 * moving in and out, and the only place a queued withdrawal can be called back.
 *
 * They are routes rather than `Segmented` tabs because each one is a page an LP
 * lands on from somewhere else: a claim receipt links to Rewards, a pending
 * withdrawal links to Transfers, and both have to survive a reload.
 */
const TABS: readonly RouteTabItem[] = [
  /* `exact` because `/pools/portfolio` is the prefix of both its siblings —
     without it the Pools cell stays lit on all three pages. */
  { href: "/pools/portfolio", label: "Pools", exact: true },
  { href: "/pools/portfolio/rewards", label: "Rewards" },
  { href: "/pools/portfolio/transfers", label: "Transfers" },
];

/**
 * The tab strip inside "Your liquidity".
 *
 * Rendered one size down from the section strip above it. Two identical strips
 * stacked would read as one two-row control; the step in size is what says the
 * second belongs to the first.
 *
 * No `"use client"`: the whole component is a constant and a `RouteTabs`, and
 * `RouteTabs` carries the boundary itself — the pathname is read there, as deep
 * in the tree as it can be.
 */
export function PortfolioNav() {
  return <RouteTabs items={TABS} label="Your liquidity" size="sm" className="self-start" />;
}
