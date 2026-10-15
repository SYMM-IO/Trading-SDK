import axios, { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { invalid, record } from "../read";

/** Token identity is separate from the SYMMIO trading chain. */
export interface MarketToken {
  address: string;
  tokenChainId: string;
}
/** Public spot-market enrichment. Missing values remain missing, not zero. */
export interface TokenMarketData {
  imageUrl?: string;
  websites?: { label?: string; url: string }[];
  socials?: { type: string; url: string }[];
  pairCreatedAt?: number;
  dexScreenerUrl?: string;
  baseTokenAddress: string;
  pairAddress?: string;
  chainId: string;
  dexId?: string;
  priceUsd?: string;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
  fdv?: number;
}
/** Batch up to any number of explicit token identities; the SDK chunks requests. */
export type GetTokenMarketDataParameters = ChainIdParameter & {
  tokens: readonly MarketToken[];
  /** Skip failed batches for optional enrichment. Default false: any failure rejects. */
  allowPartial?: boolean;
};
/** One row per resolved token, selected from its deepest base-token pool. */
export type GetTokenMarketDataReturnType = TokenMarketData[];
function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function links(value: unknown): { url: string; label?: string; type?: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const row = record(item);
    return row && typeof row.url === "string" ? [{ url: row.url, label: text(row.label), type: text(row.type) }] : [];
  });
}
function addressKey(address: string, chain: string): string {
  return chain === "solana" ? address : address.toLowerCase();
}
/**
 * Read DexScreener token pairs in batches of 30. Only matching-chain base tokens
 * participate in deepest-pool selection; quote-token matches are never substituted.
 * HTTP failures reject so callers can keep their own stale/fallback policy.
 */
export async function getTokenMarketData(
  config: Config,
  parameters: GetTokenMarketDataParameters,
): Promise<GetTokenMarketDataReturnType> {
  config.getChainConfig(parameters.chainId);
  const tokens = [
    ...new Map(
      parameters.tokens.map((token) => [
        `${token.tokenChainId}:${addressKey(token.address, token.tokenChainId)}`,
        token,
      ]),
    ).values(),
  ];
  if (tokens.some((token) => !/^[A-Za-z0-9]+$/.test(token.address) || !token.tokenChainId))
    invalid("Invalid token identity");
  const result: TokenMarketData[] = [];
  for (let offset = 0; offset < tokens.length; offset += 30) {
    const batch = tokens.slice(offset, offset + 30);
    try {
      const { data } = await axios.get<unknown>(
        `https://api.dexscreener.com/latest/dex/tokens/${batch.map((token) => token.address).join(",")}`,
        { timeout: 10_000 },
      );
      const rawPairs = record(data)?.pairs;
      if (rawPairs === null) continue;
      if (!Array.isArray(rawPairs)) invalid("Invalid token market response");
      const pairs = rawPairs.flatMap((value) => {
        const row = record(value);
        return row ? [row] : [];
      });
      for (const token of batch) {
        const matching = pairs.filter(
          (pair) =>
            pair.chainId === token.tokenChainId &&
            typeof record(pair.baseToken)?.address === "string" &&
            addressKey(String(record(pair.baseToken)?.address), token.tokenChainId) ===
              addressKey(token.address, token.tokenChainId),
        );
        if (!matching.length) continue;
        const best = matching.reduce((a, b) =>
          (number(record(b.liquidity)?.usd) ?? 0) > (number(record(a.liquidity)?.usd) ?? 0) ? b : a,
        );
        const info = record(best.info);
        result.push({
          baseTokenAddress: String(record(best.baseToken)?.address),
          chainId: token.tokenChainId,
          imageUrl: text(info?.imageUrl) ?? matching.map((pair) => text(record(pair.info)?.imageUrl)).find(Boolean),
          websites: links(info?.websites),
          socials: links(info?.socials)?.map((link) => ({ type: link.type ?? "", url: link.url })),
          pairCreatedAt: number(best.pairCreatedAt),
          dexScreenerUrl: text(best.url),
          pairAddress: text(best.pairAddress),
          dexId: text(best.dexId),
          priceUsd: text(best.priceUsd),
          marketCap: number(best.marketCap),
          liquidity: number(record(best.liquidity)?.usd),
          volume24h: number(record(best.volume)?.h24),
          priceChange24h: number(record(best.priceChange)?.h24),
          fdv: number(best.fdv),
        });
      }
    } catch (error) {
      if (parameters.allowPartial) continue;
      if (isAxiosError(error))
        throw SymmApiError.fromAxios(error, {
          code: "FETCH_TOKEN_MARKET_DATA_FAILED",
          baseURL: "https://api.dexscreener.com",
        });
      throw error;
    }
  }
  return result;
}
