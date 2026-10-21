import axios from "axios";

/** Public DEX pair metadata used to enrich a token without coupling it to a listing deployment. */
export interface PoolDexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  volume: { h24: number };
  priceChange: { h24: number };
  info?: { imageUrl?: string; websites?: { label?: string; url: string }[]; socials?: { type: string; url: string }[] };
  pairCreatedAt?: number;
}

/** Read DEX pairs for one token. The address is sent verbatim, including case-sensitive mints. */
export async function getPoolDexData(tokenAddress: string): Promise<{ pairs: PoolDexPair[] | null }> {
  const { data } = await axios.get<{ pairs: PoolDexPair[] | null }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(tokenAddress)}`,
    { timeout: 20_000 },
  );
  return data;
}

/** Batch DEX reads in groups of 30; a failed batch does not discard successful batches. Results use exact token addresses. */
export async function getPoolDexDataBatch(tokenAddresses: readonly string[]): Promise<Map<string, PoolDexPair[]>> {
  const result = new Map<string, PoolDexPair[]>();
  const unique = [...new Set(tokenAddresses)];
  for (let i = 0; i < unique.length; i += 30) {
    try {
      const { data } = await axios.get<{ pairs: PoolDexPair[] | null }>(
        `https://api.dexscreener.com/latest/dex/tokens/${unique
          .slice(i, i + 30)
          .map(encodeURIComponent)
          .join(",")}`,
        { timeout: 20_000 },
      );
      for (const pair of data.pairs ?? []) {
        const address = pair.baseToken?.address;
        if (!address) continue;
        result.set(address, [...(result.get(address) ?? []), pair]);
      }
    } catch {
      /* Optional enrichment: retain successful batches. */
    }
  }
  return result;
}

/** Choose the highest-liquidity priced pair, falling back to the highest-liquidity pair if none has a price. */
export function selectPoolDexPair(pairs: readonly PoolDexPair[]): PoolDexPair | undefined {
  const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return sorted.find((pair) => pair.priceUsd != null) ?? sorted[0];
}
