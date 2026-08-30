"use client";

import { MicroLabel } from "@/components/panel";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useListingMarketDetail } from "@symmio/trading-react";
import { ClaimHistoryPanel } from "./claim-history-panel";
import { PoolCharts } from "./pool-charts";
import { PoolYieldWindows } from "./pool-yield-windows";
import { POOLS_CHAIN_ID, usePoolsSupported } from "./pools-deployment";
import { YourPositionPanel } from "./your-position-panel";

export interface PoolOverviewProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
}

/**
 * What the pool holds, what it pays, and where you stand in it.
 *
 * The two columns are deliberately not one stack, and the split is by *shape*
 * rather than by audience: the rail is the pool's controls — balance, deposit
 * address, withdrawal form, the Claim button — and it stays beside the charts
 * because depositing is a decision made while looking at them, while the left
 * column is everything wide enough to need the width. The charts and the yield
 * windows are the pool as a public object; the claim ledger under them is
 * yours, narrowed to this pool, and it is a table with five columns and a
 * pager. Squeezing that into a 380px rail is what would make it unreadable, so
 * "public left, private right" is not the rule here — "wide left, controls
 * right" is.
 *
 * The read is `useListingMarketDetail` again, the same call the chrome makes.
 * The key is identical so React Query answers both from one request; see
 * `pool-detail-chrome.tsx` for why the value is not passed down instead.
 */
export function PoolOverview({ address, chainId }: PoolOverviewProps) {
  const supported = usePoolsSupported();

  const detail = useListingMarketDetail({
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  const symbolId = detail.data?.symbolId ?? null;

  /* A disabled query stays `isPending` forever, so the loading flag is ANDed
     with `supported`: on a chain with no listing backend the panels must reach
     their own "nothing here" state rather than skeleton indefinitely. */
  const isDetailLoading = supported && detail.isPending;

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PoolCharts address={address} chainId={chainId} symbolId={symbolId} />
          <PoolYieldWindows detail={detail.data} isLoading={isDetailLoading} />

          {/* The pool-scoped half of the claim ledger, which exists nowhere
              else: the portfolio surface mounts this same panel with no props
              for every pool at once, and `getClaimHistory` is the only read
              that takes a token address as a filter. Handing it one here is
              what turns the panel's "This pool only" scope line on — and this
              is the page it belongs on, since the Claim button that writes
              these rows is in the rail a column away.

              `depositChain` is not part of the read. The endpoint is scoped by
              token address alone, but an address does not identify a pool —
              two chains can carry the same one — so the panel needs the chain
              to name the pool it says it is showing. */}
          <ClaimHistoryPanel tokenContractAddress={address} depositChain={chainId} />
        </div>

        <div className="w-full shrink-0 xl:w-[380px]">
          <YourPositionPanel address={address} chainId={chainId} ticker={detail.data?.tokenTicker ?? undefined} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <MicroLabel>Provenance</MicroLabel>
        <p className="max-w-[104ch] text-2xs text-fg-3">
          Inventory, your position, rewards and the claim ledger come from the listing backend; the TVL series from the
          inventory service; daily volume from the Enigma solver. A pool with no{" "}
          <span className="font-mono">symbolId</span> has no solver market yet, so nothing has traded against it and its
          volume series is empty.
        </p>
      </div>
    </>
  );
}
