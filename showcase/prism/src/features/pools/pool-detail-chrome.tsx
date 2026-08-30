"use client";

import { Panel } from "@/components/panel";
import { RouteTabs, type RouteTabItem } from "@/components/route-tabs";
import { EmptyState } from "@/components/table";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useListingMarketDetail } from "@symmio/trading-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ListingStatusPanel } from "./listing-status-panel";
import { PoolHeader } from "./pool-header";
import { POOLS_CHAIN_ID, usePoolsSupported } from "./pools-deployment";

export interface PoolDetailChromeProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
  /** The tab body: overview, activity or config. */
  children: ReactNode;
}

/**
 * Everything about a pool that does not change when you switch tabs.
 *
 * A pool looks like a single product and is assembled from four services, so
 * this surface keeps their seams visible: identity, inventory and yield come
 * from the listing backend, the TVL series from the inventory service, daily
 * volume from the solver, and the trade tables from the analytics subgraph.
 * Your own position in it is the same listing backend again, but behind a
 * signature.
 *
 * The pool is addressed by the pair `(contractAddress, depositChain)` — the
 * same token can be listed from more than one chain, and an address alone is
 * ambiguous.
 *
 * ## Why the identity read lives here and is repeated below
 *
 * The header, the status panel, the yield windows and the books all describe
 * the same market detail. This component owns the read because the header and
 * the status panel are chrome and must be right before any tab renders — and
 * because the error branch belongs to the pool, not to a tab: if the pool did
 * not load there is nothing for a tab to say, so `children` is not rendered at
 * all.
 *
 * The tab bodies call `useListingMarketDetail` again rather than receiving the
 * result as a prop. That is not a duplicate fetch: the key is identical, so
 * React Query serves both callers from one request. It is also the only option
 * available — a layout hands its children through the `children` slot, which is
 * rendered by the router and cannot be given props, so the alternative would be
 * a context that exists purely to move data the cache already holds.
 */
export function PoolDetailChrome({ address, chainId, children }: PoolDetailChromeProps) {
  const supported = usePoolsSupported();

  const detail = useListingMarketDetail({
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  /* A disabled query stays `isPending` forever, so the loading flag below is
     ANDed with `supported`: on a chain with no listing backend the panels must
     reach their own "nothing here" state rather than skeleton indefinitely. */
  const isDetailLoading = supported && detail.isPending;

  /* The address arrives decoded — the route segment is encoded, and `RouteTabs`
     compares its hrefs against the encoded pathname, so it has to go back the
     way it came. For a `0x…` or base58 address this is the identity function;
     it exists for the chains where it is not. */
  const base = `/pools/${chainId}/${encodeURIComponent(address)}`;

  const tabs: readonly RouteTabItem[] = [
    /* `exact` because the overview *is* the pool's base path, which is the
       prefix of every other tab — without it the overview cell stays lit on
       Activity and Config and two cells light at once. */
    { href: base, label: "Overview", exact: true },
    { href: `${base}/activity`, label: "Activity" },
    { href: `${base}/config`, label: "Config" },
  ];

  if (detail.error) {
    return (
      <>
        <BackLink />
        <Panel>
          <EmptyState
            title="This pool did not load"
            body={detail.error.message}
            action={
              <Link href="/pools" className="text-md text-accent">
                Back to the catalog
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <BackLink />

      <PoolHeader address={address} chainId={chainId} detail={detail.data} isLoading={isDetailLoading} />

      <ListingStatusPanel address={address} chainId={chainId} marketStatus={detail.data?.marketStatus} />

      <RouteTabs items={tabs} label="Pool views" className="self-start" />

      {children}
    </>
  );
}

/**
 * The way out of a pool.
 *
 * A pool page is almost always arrived at from the catalog, and the browser's
 * own back button is the wrong affordance once the reader has walked three tabs
 * deep — it would take them to Config, not out.
 */
function BackLink() {
  return (
    <Link
      href="/pools"
      className="w-fit text-2xs tracking-[0.12em] text-fg-3 uppercase transition-colors duration-[var(--dur-fast)] hover:text-fg-1"
    >
      ← All pools
    </Link>
  );
}
