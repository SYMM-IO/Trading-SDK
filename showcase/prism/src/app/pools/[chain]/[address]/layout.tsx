import { PoolDetailChrome } from "@/features/pools/pool-detail-chrome";
import type { ListingDepositChainId } from "@symmio/trading-core";
import type { ReactNode } from "react";

/**
 * The shell every page of one pool renders inside.
 *
 * A pool is three surfaces — what it holds, what has happened to it, and how
 * this LP would have it quoted — and all three sit under the same identity: the
 * back link, the header, the listing pipeline and the tab strip. Putting them
 * in a layout keeps that chrome mounted across a tab switch, so moving between
 * tabs does not re-run the identity read or flash the header.
 *
 * There is no container here on purpose. `src/app/pools/layout.tsx` already
 * provides the column every `/pools/*` route renders into; a second one would
 * double the padding and the `gap-4` seam.
 */
export default async function PoolLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ chain: string; address: string }>;
}) {
  const { chain, address } = await params;

  return (
    <PoolDetailChrome address={decodeURIComponent(address)} chainId={Number(chain) as ListingDepositChainId}>
      {children}
    </PoolDetailChrome>
  );
}
