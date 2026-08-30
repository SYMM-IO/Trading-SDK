import { PoolOverview } from "@/features/pools/pool-overview";
import type { ListingDepositChainId } from "@symmio/trading-core";

/**
 * A pool's overview: its value and yield over time, and your position in it.
 *
 * The route carries the pair that identifies a pool — its deposit chain and its
 * token address — because the address alone is ambiguous across chains, and
 * because a link to a pool has to survive a reload without a client-side
 * selection to restore.
 */
export default async function PoolPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;

  return <PoolOverview address={decodeURIComponent(address)} chainId={Number(chain) as ListingDepositChainId} />;
}
