import axios from "axios";

/** Token identity plus the provider's network slug. Unsupported networks should be omitted by callers. */
export interface PoolGeckoTarget {
  chainId: number;
  address: string;
  network: string;
}

/** Chain-scoped lookup key preserving case-sensitive Solana addresses. */
export function poolEnrichmentKey(chainId: number, address: string): string {
  return `${chainId}:${chainId === 0 ? address : address.toLowerCase()}`;
}

/** Read market cap (or FDV when circulating supply is unknown), batching at most 30 tokens per network. A failed chunk leaves other results intact. */
export async function getPoolGeckoMarketCaps(targets: readonly PoolGeckoTarget[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const groups = new Map<string, Map<string, PoolGeckoTarget>>();
  for (const target of targets) {
    if (!target.network || !target.address) continue;
    const groupKey = `${target.chainId}:${target.network}`;
    const group = groups.get(groupKey) ?? new Map<string, PoolGeckoTarget>();
    group.set(poolEnrichmentKey(target.chainId, target.address), target);
    groups.set(groupKey, group);
  }
  const requests: Promise<void>[] = [];
  for (const group of groups.values()) {
    const values = [...group.values()];
    for (let i = 0; i < values.length; i += 30) {
      const chunk = values.slice(i, i + 30);
      const first = chunk[0]!;
      requests.push(
        axios
          .get<{
            data?: {
              attributes?: {
                address?: string;
                market_cap_usd?: string | number | null;
                fdv_usd?: string | number | null;
              };
            }[];
          }>(
            `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(first.network)}/tokens/multi/${chunk.map((t) => encodeURIComponent(t.address)).join(",")}`,
            { timeout: 10_000 },
          )
          .then(({ data }) => {
            for (const { attributes } of data.data ?? []) {
              if (!attributes?.address) continue;
              const cap = positive(attributes.market_cap_usd) ?? positive(attributes.fdv_usd);
              if (cap != null) result.set(poolEnrichmentKey(first.chainId, attributes.address), cap);
            }
          })
          .catch(() => {
            /* Optional enrichment. */
          }),
      );
    }
  }
  await Promise.all(requests);
  return result;
}

function positive(value: string | number | null | undefined): number | undefined {
  const number = typeof value === "string" ? parseFloat(value) : value;
  return number != null && Number.isFinite(number) && number > 0 ? number : undefined;
}
