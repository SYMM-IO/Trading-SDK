import { MarketConfigPanel } from "@/features/pools/market-config-panel";
import type { ListingDepositChainId } from "@symmio/trading-core";

/**
 * One pool's market-config tab.
 *
 * The same `(depositChain, tokenAddress)` pair the pool's other tabs are
 * addressed by, coerced here at the route boundary rather than deeper, because
 * everything below this file takes the pool as an identity and not as two
 * strings off a URL.
 */
export default async function PoolConfigPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;

  return <MarketConfigPanel address={decodeURIComponent(address)} chainId={Number(chain) as ListingDepositChainId} />;
}
