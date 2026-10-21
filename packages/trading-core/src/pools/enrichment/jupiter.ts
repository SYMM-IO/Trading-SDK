import axios from "axios";

/** Read positive Solana prices in batches of 50. Exact mint casing is retained; failures affect only their batch. */
export async function getPoolJupiterPrices(mints: readonly string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const unique = [...new Set(mints)];
  for (let i = 0; i < unique.length; i += 50) {
    try {
      const { data } = await axios.get<Record<string, { usdPrice?: number } | null>>(
        "https://lite-api.jup.ag/price/v3",
        { params: { ids: unique.slice(i, i + 50).join(",") }, timeout: 20_000 },
      );
      for (const [mint, value] of Object.entries(data)) {
        const price = value?.usdPrice;
        if (typeof price === "number" && Number.isFinite(price) && price > 0) result.set(mint, price);
      }
    } catch {
      /* Optional enrichment: retain successful batches. */
    }
  }
  return result;
}
