import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getGetMarketInfo } from "../types/generated/enigma-solver";
import { toMarketInfo } from "./to-market-info";
import type { GetMarketInfoReturnType } from "./types";

/**
 * Parameters for {@link getMarketInfo}.
 */
export type GetMarketInfoParameters = Compute<ChainIdParameter>;

/**
 * Fetch per-market 24h volume from the chain's solver `/get_market_info`
 * endpoint. Returns the rolling 24-hour trading volume and cumulative lifetime
 * value for every market, plus the aggregate totals across all markets. The
 * solver base URL is resolved from `config` per call, so multiple chains never
 * clobber each other.
 *
 * Amounts are surfaced as plain `number` dollar values exactly as the solver
 * reports them; no decimal scaling is applied.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id (defaults to the config's default chain).
 * @returns Normalized {@link GetMarketInfoReturnType} — per-market rows and totals.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const info = await getMarketInfo(config);
 * const btc = info.markets.find((m) => m.symbol === "BTCUSDT");
 * console.log(btc?.tradingVolume, info.totalValue24h);
 * ```
 */
export async function getMarketInfo(
  config: Config,
  parameters: GetMarketInfoParameters = {},
): Promise<GetMarketInfoReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  return fetchMarketInfo(solver.url);
}

/**
 * Call the solver's `/get_market_info` endpoint with a per-call base URL and map
 * the flat response into the SDK's normalized totals + per-market rows.
 *
 * @internal
 */
async function fetchMarketInfo(baseURL: string): Promise<GetMarketInfoReturnType> {
  try {
    const response = await getGetMarketInfo({ baseURL });
    return toMarketInfo(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_MARKET_INFO_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_MARKET_INFO_FAILED",
      `Failed to fetch market info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
