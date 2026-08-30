"use client";

import Link from "next/link";
import { useState } from "react";
import { CreatePoolModal } from "./create-pool-modal";
import { useListingSession } from "./listing-session";
import { PoolsCatalog } from "./pools-catalog";
import { PoolsSummary } from "./pools-summary";

/**
 * Discover: the public half of the Pools surface.
 *
 * Every lowcap market on the Markets screen exists because somebody funded a
 * pool for it, and this screen is that catalog — what the custodial system
 * holds in aggregate, what each listing pays, and the form that lists a token
 * with no pool yet, which is the one place in Prism a market is created rather
 * than traded.
 *
 * ## Why the wallet's own pools are no longer here
 *
 * This screen used to stack the catalog, then the pools this wallet is an LP
 * in, then its unclaimed rewards. That is two jobs on one page: a reader who
 * came to check their own position had to scroll past every pool that exists to
 * reach the three that are theirs, and a reader browsing the catalog paged
 * through a wallet-gated panel that had nothing to say to them. Those panels
 * moved to `/pools/portfolio`, and what is left needs no wallet at all — the
 * only signed-in thing on the page is the link across to them.
 *
 * ## Three backends, deliberately not blended
 *
 * Custodial TVL comes from the inventory service, volume and open interest and
 * revenue from the solver, and the catalog with every per-pool figure from the
 * listing backend. Where two of them disagree — headline TVL against the sum of
 * the catalog's TVL column — that is a fact about the system, not a bug in the
 * page.
 *
 * ## What this screen deliberately does not render
 *
 * The eyebrow, the headline, the lede, the scope notice and the section tabs
 * are chrome for the whole surface, so they live in `pools-nav.tsx` and are
 * rendered by `src/app/pools/layout.tsx`. So are `ListingSessionProvider` and
 * the page container: mounting a second provider here would fork the session
 * onto the same storage slot, and re-declaring the container would double the
 * padding and the column gap.
 */
export function PoolsScreen() {
  const [creating, setCreating] = useState(false);
  const { isSignedIn } = useListingSession();

  return (
    <>
      <PoolsSummary />

      <PoolsCatalog
        onCreate={() => setCreating(true)}
        aside={
          /* Only when signed in. Signed out, "Your liquidity" is a promise of a
             page with nothing on it, and the tab strip above already offers the
             route to anyone who wants to go looking. This link exists for the
             reader who had their positions on *this* page and is now wondering
             where they went — so it is worth showing exactly to the wallet that
             had them. */
          isSignedIn ? (
            <Link
              href="/pools/portfolio"
              className="cursor-pointer text-sm whitespace-nowrap text-accent transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-fg-0"
            >
              Your liquidity →
            </Link>
          ) : null
        }
      />

      <p className="max-w-[104ch] px-1 text-2xs text-fg-3">
        Headline TVL is the inventory service&rsquo;s custodial total, not the sum of the catalog&rsquo;s TVL column —
        the catalog covers listed markets, custody covers the whole system, and the two legitimately differ. A dash
        means the service reported nothing, which is not the same as zero.
      </p>

      <CreatePoolModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
