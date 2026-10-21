import axios from "axios";

/** Launchpad graduation state; false means the token is still on its bonding curve. */
export interface PoolPumpInfo {
  complete: boolean;
}

/** Read launchpad metadata through a caller-configured server proxy (the upstream rejects browser requests). The proxy accepts a comma-separated `mints` query and returns mint-keyed metadata. */
export async function getPoolPumpData(mints: readonly string[], proxyUrl: string): Promise<Map<string, PoolPumpInfo>> {
  const result = new Map<string, PoolPumpInfo>();
  const unique = [...new Set(mints)];
  for (let i = 0; i < unique.length; i += 50) {
    try {
      const { data } = await axios.get<Record<string, PoolPumpInfo>>(proxyUrl, {
        params: { mints: unique.slice(i, i + 50).join(",") },
        timeout: 20_000,
      });
      for (const [mint, info] of Object.entries(data)) if (typeof info?.complete === "boolean") result.set(mint, info);
    } catch {
      /* Optional enrichment: retain successful batches. */
    }
  }
  return result;
}
