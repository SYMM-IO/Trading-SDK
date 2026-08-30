import { PoolActivity } from "@/features/pools/pool-activity";
import type { ListingDepositChainId } from "@symmio/trading-core";

/**
 * A pool's five books: inventory, open quotes, triggers, trade history and
 * transactions.
 *
 * The params are re-read here rather than inherited from the layout because a
 * layout cannot hand props to the `children` slot the router fills — every page
 * under `[chain]/[address]` coerces the same pair at its own boundary.
 */
export default async function PoolActivityPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;

  return <PoolActivity address={decodeURIComponent(address)} chainId={Number(chain) as ListingDepositChainId} />;
}
