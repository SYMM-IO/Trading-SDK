"use client";

import { MicroLabel } from "@/components/panel";
import { RouteTabs, type RouteTabItem } from "@/components/route-tabs";
import { usePathname } from "next/navigation";
import { PoolsScopeNotice } from "./pools-scope-notice";

/**
 * The two halves of the Pools surface.
 *
 * Discover is the public catalog — it answers "what pools exist and what do
 * they pay" and needs no wallet. Your liquidity is everything the listing
 * backend will only say to a signed-in address. They are separate routes rather
 * than tabs on one screen because the second half is three pages deep
 * (positions, rewards, transfers) and each of those is somewhere a reader wants
 * to land from a link.
 */
const TABS: readonly RouteTabItem[] = [
  /* `exact` because `/pools` is the prefix of literally every route on this
     surface — without it Discover stays lit on the portfolio pages and on
     every pool detail page, and two cells light at once. */
  { href: "/pools", label: "Discover", exact: true },
  { href: "/pools/portfolio", label: "Your liquidity" },
];

/**
 * The chrome shared by the Pools index and the portfolio pages.
 *
 * ## Why this is a component and not just markup in the layout
 *
 * `src/app/pools/layout.tsx` wraps **every** `/pools/*` route, pool detail
 * pages included, because that is where the one listing session has to live.
 * But a pool's own page is not a third tab in this strip — it is a place you
 * navigated *to* from one of them, and it carries its own header, its own
 * status panel and its own tab strip. Showing "Every lowcap starts as a pool"
 * above that would title the page after the section rather than the pool.
 *
 * So the layout mounts the provider unconditionally and this component decides
 * whether the section chrome belongs on the current route. Reading the pathname
 * is the only way to make that call: a layout cannot see which child rendered
 * beneath it, and passing the answer down would mean every leaf page opting in
 * to chrome it does not own.
 *
 * The scope notice rides along for the same reason the tabs do — that Pools
 * reads one chain and does not follow the palette mode is true on every route
 * under this layout, including the detail pages, so it is rendered outside the
 * chrome gate.
 */
export function PoolsNav() {
  const pathname = usePathname();

  /* The section pages are the index and the portfolio tree. Anything else under
     `/pools/` is a pool, addressed by `[chain]/[address]`. */
  const isSectionPage =
    pathname === "/pools" || pathname === "/pools/portfolio" || pathname.startsWith("/pools/portfolio/");

  if (!isSectionPage) return <PoolsScopeNotice />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <MicroLabel>Liquidity</MicroLabel>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-fg-0">Every lowcap starts as a pool</h1>
        <p className="max-w-[76ch] text-md text-fg-2">
          A lowcap perp has no exchange listing and no order book behind it — it is quoted against a pool that LPs fund
          and the solver hedges into. Browse what those pools hold and pay, take a position in one, or list a token that
          has none yet.
        </p>
      </div>

      <PoolsScopeNotice />

      <RouteTabs items={TABS} label="Pools sections" className="self-start" />
    </>
  );
}
