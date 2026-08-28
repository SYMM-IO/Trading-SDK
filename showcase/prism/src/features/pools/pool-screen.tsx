"use client";

import { MicroLabel, Panel } from "@/components/panel";
import { EmptyState } from "@/components/table";
import { ListingDepositChainId } from "@symmio/trading-core";
import { useListingMarketDetail } from "@symmio/trading-react";
import Link from "next/link";
import { ListingSessionProvider } from "./listing-session";
import { ListingStatusPanel } from "./listing-status-panel";
import { PoolCharts } from "./pool-charts";
import { PoolHeader } from "./pool-header";
import { PoolTables } from "./pool-tables";
import { PoolYieldWindows } from "./pool-yield-windows";
import { POOLS_CHAIN_ID, usePoolsSupported } from "./pools-deployment";
import { YourPositionPanel } from "./your-position-panel";

export interface PoolScreenProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
}

/**
 * One pool, end to end.
 *
 * A pool looks like a single product and is assembled from four services, so
 * this page keeps their seams visible: identity, inventory and yield come from
 * the listing backend, the TVL series from the inventory service, daily volume
 * from the solver, and the trade tables from the analytics subgraph. Your own
 * position in it is the same listing backend again, but behind a signature.
 *
 * The pool is addressed by the pair `(contractAddress, depositChain)` — the
 * same token can be listed from more than one chain, and an address alone is
 * ambiguous.
 */
export function PoolScreen({ address, chainId }: PoolScreenProps) {
  const supported = usePoolsSupported();

  const detail = useListingMarketDetail({
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  const symbolId = detail.data?.symbolId ?? null;

  /* A disabled query stays `isPending` forever, so the loading flags below are
     ANDed with `supported`: on a chain with no listing backend the panels must
     reach their own "nothing here" state rather than skeleton indefinitely. */

  return (
    <ListingSessionProvider>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5">
        <Link
          href="/pools"
          className="w-fit text-2xs tracking-[0.12em] text-fg-3 uppercase transition-colors duration-[var(--dur-fast)] hover:text-fg-1"
        >
          ← All pools
        </Link>

        {detail.error ? (
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
        ) : (
          <>
            <PoolHeader
              address={address}
              chainId={chainId}
              detail={detail.data}
              isLoading={supported && detail.isPending}
            />

            <ListingStatusPanel address={address} chainId={chainId} marketStatus={detail.data?.marketStatus} />

            <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <PoolCharts address={address} chainId={chainId} symbolId={symbolId} />
                <PoolYieldWindows detail={detail.data} isLoading={supported && detail.isPending} />
              </div>

              <div className="w-full shrink-0 xl:w-[380px]">
                <YourPositionPanel address={address} chainId={chainId} ticker={detail.data?.tokenTicker ?? undefined} />
              </div>
            </div>

            <PoolTables
              address={address}
              chainId={chainId}
              symbolId={symbolId}
              detail={detail.data}
              isDetailLoading={supported && detail.isPending}
            />

            <div className="flex flex-col gap-1.5 px-1">
              <MicroLabel>Provenance</MicroLabel>
              <p className="max-w-[104ch] text-2xs text-fg-3">
                Inventory, positions and rewards come from the listing backend; the TVL series from the inventory
                service; daily volume from the Enigma solver; open quotes, trade history and trigger orders from the
                analytics subgraph and the TP/SL handler. A pool with no <span className="font-mono">symbolId</span> has
                no solver market yet, so only its deposits and withdrawals exist.
              </p>
            </div>
          </>
        )}
      </div>
    </ListingSessionProvider>
  );
}
