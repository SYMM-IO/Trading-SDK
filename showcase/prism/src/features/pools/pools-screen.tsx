"use client";

import { MicroLabel } from "@/components/panel";
import { useState } from "react";
import { CreatePoolModal } from "./create-pool-modal";
import { ListingSessionProvider } from "./listing-session";
import { PoolsCatalog } from "./pools-catalog";
import { PoolsScopeNotice } from "./pools-scope-notice";
import { PoolsSummary } from "./pools-summary";
import { YourPoolsPanel } from "./your-pools-panel";
import { YourRewardsPanel } from "./your-rewards-panel";

/**
 * The liquidity side of the book.
 *
 * Every lowcap market on the Markets screen exists because somebody funded a
 * pool for it. This screen is that side: what the whole custodial system holds,
 * the catalog of pools and what each one pays, the pools this wallet is an LP
 * in — and the form that lists a new token, which is the one place in Prism a
 * market can be created rather than traded.
 *
 * Four backends answer here and they are deliberately not blended: custodial
 * TVL comes from the inventory service, volume and open interest and revenue
 * from the solver, the catalog and every "your" figure from the listing
 * backend, and the pool's own trade tables from the analytics subgraph. Where
 * two of them disagree — headline TVL against the sum of the catalog's column —
 * that is a fact about the system, not a bug in the page.
 */
export function PoolsScreen() {
  const [creating, setCreating] = useState(false);

  return (
    <ListingSessionProvider>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5">
        <div className="flex flex-col gap-1">
          <MicroLabel>Liquidity</MicroLabel>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-fg-0">
            Every lowcap starts as a pool
          </h1>
          <p className="max-w-[76ch] text-md text-fg-2">
            A lowcap perp has no exchange listing and no order book behind it — it is quoted against a pool that LPs
            fund and the solver hedges into. Browse what those pools hold and pay, take a position in one, or list a
            token that has none yet.
          </p>
        </div>

        <PoolsScopeNotice />

        <PoolsSummary />

        <PoolsCatalog onCreate={() => setCreating(true)} />

        <YourPoolsPanel />

        <YourRewardsPanel />

        <p className="max-w-[104ch] px-1 text-2xs text-fg-3">
          Headline TVL is the inventory service&rsquo;s custodial total, not the sum of the catalog&rsquo;s TVL column —
          the catalog covers listed markets, custody covers the whole system, and the two legitimately differ. A dash
          means the service reported nothing, which is not the same as zero.
        </p>
      </div>

      <CreatePoolModal open={creating} onClose={() => setCreating(false)} />
    </ListingSessionProvider>
  );
}
