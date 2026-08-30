"use client";

import { MicroLabel } from "@/components/panel";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useListingMarketDetail } from "@symmio/trading-react";
import { PoolTables } from "./pool-tables";
import { POOLS_CHAIN_ID, usePoolsSupported } from "./pools-deployment";

export interface PoolActivityProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's own deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
}

/**
 * Everything that has happened to this pool, in five books.
 *
 * They live on their own route rather than under the charts because each book
 * is a separate service call and only the open one fetches — a reader who came
 * to check the TVL should not pay for a subgraph query, a TP/SL search and a
 * paged transaction feed on the way in.
 *
 * The read is `useListingMarketDetail` again, the same call the chrome makes.
 * The key is identical so React Query answers both from one request; see
 * `pool-detail-chrome.tsx` for why the value is not passed down instead.
 */
export function PoolActivity({ address, chainId }: PoolActivityProps) {
  const supported = usePoolsSupported();

  const detail = useListingMarketDetail({
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  /* A disabled query stays `isPending` forever, so the loading flag is ANDed
     with `supported`: on a chain with no listing backend the books must reach
     their own "nothing here" state rather than skeleton indefinitely. */
  const isDetailLoading = supported && detail.isPending;

  return (
    <>
      <PoolTables
        address={address}
        chainId={chainId}
        symbolId={detail.data?.symbolId ?? null}
        detail={detail.data}
        isDetailLoading={isDetailLoading}
      />

      <div className="flex flex-col gap-1.5 px-1">
        <MicroLabel>Provenance</MicroLabel>
        <p className="max-w-[104ch] text-2xs text-fg-3">
          Open quotes and trade history come from the analytics subgraph, trigger orders from the TP/SL handler,
          deposits and withdrawals from the listing backend’s paged transaction feed, and the inventory book is that
          same backend’s market detail reshaped locally. A pool with no <span className="font-mono">symbolId</span> has
          no solver market yet, so only its deposits and withdrawals exist.
        </p>
      </div>
    </>
  );
}
